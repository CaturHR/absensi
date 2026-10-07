/**
 * Service Notifikasi Real-time untuk Admin
 * 
 * Menggunakan Server-Sent Events (SSE) sebagai metode utama.
 * SSE tidak bergantung pada layanan push pihak ketiga (FCM/APNS),
 * sehingga bekerja di jaringan manapun.
 * 
 * Browser Notification API digunakan untuk menampilkan notifikasi OS
 * saat menerima event dari SSE.
 */

let eventSource = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
let isInitializing = false;
const MAX_RECONNECT_DELAY = 30000; // 30 detik max

// Cache deduplikasi dalam memori (key -> timestamp)
const recentNotifications = new Map();

/**
 * Mainkan suara notifikasi menggunakan Web Audio API sintetis (tanpa file eksternal)
 */
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Pastikan AudioContext resume jika dalam status suspended
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Nada pertama (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    // Nada kedua (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.12);
    gain2.gain.setValueAtTime(0.15, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch (e) {
    // Autoplay policy browser mungkin memblokir audio sebelum interaksi user
    console.debug('[Notif] Audio chime skipped:', e.message);
  }
}

/**
 * Inisialisasi notifikasi real-time untuk admin.
 * 1. Minta izin notifikasi browser jika belum
 * 2. Buka koneksi SSE ke backend
 * 
 * @returns {Promise<{status: string, message: string}>}
 */
export async function initRealtimeNotification() {
  if (isInitializing) {
    return { status: 'pending', message: 'Inisialisasi notifikasi sedang berjalan...' };
  }
  isInitializing = true;

  try {
    console.log('[Notif] Memulai inisialisasi notifikasi real-time...');

    // 1. Minta izin notifikasi browser
    if ('Notification' in window) {
      const currentPermission = Notification.permission;
      console.log('[Notif] Izin notifikasi saat ini:', currentPermission);

      if (currentPermission === 'default') {
        try {
          const permission = await Notification.requestPermission();
          console.log('[Notif] Hasil permintaan izin:', permission);
          if (permission !== 'granted') {
            console.log('[Notif] Izin notifikasi ditolak, notifikasi OS tidak akan muncul.');
          }
        } catch (permErr) {
          console.warn('[Notif] Gagal meminta izin notifikasi:', permErr);
        }
      }
    }

    // 2. Buka koneksi SSE
    connectSSE();

    return { status: 'connected', message: 'Notifikasi real-time aktif.' };
  } finally {
    isInitializing = false;
  }
}

/**
 * Buka koneksi SSE ke backend.
 */
function connectSSE() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.warn('[Notif] Token tidak ditemukan, tidak bisa membuka SSE.');
    return;
  }

  // Tutup koneksi lama jika ada untuk mencegah duplikasi
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  const sseUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
  
  console.log('[Notif] Membuka koneksi SSE...');
  eventSource = new EventSource(sseUrl);

  // Event: Koneksi berhasil
  eventSource.addEventListener('connected', (event) => {
    try {
      console.log('[Notif] ✅ SSE terhubung:', JSON.parse(event.data));
    } catch {
      console.log('[Notif] ✅ SSE terhubung.');
    }
    reconnectAttempts = 0; // Reset counter
  });

  // Event: Permohonan izin baru
  eventSource.addEventListener('leave-request', (event) => {
    console.log('[Notif] 📋 Event leave-request diterima:', event.data);
    try {
      const data = JSON.parse(event.data);
      handleIncomingLeaveNotification(data);
    } catch (e) {
      console.error('[Notif] Error parsing leave-request event:', e);
    }
  });

  // Event: Update status permohonan izin
  eventSource.addEventListener('leave-request-updated', (event) => {
    console.log('[Notif] 📝 Event leave-request-updated diterima:', event.data);
    try {
      const data = JSON.parse(event.data);
      handleIncomingLeaveNotification(data);
    } catch (e) {
      console.error('[Notif] Error parsing leave-request-updated event:', e);
    }
  });

  // Event: Error / koneksi terputus
  eventSource.onerror = (error) => {
    console.warn('[Notif] ⚠️ SSE error/disconnected:', error);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    // Auto-reconnect dengan exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    console.log(`[Notif] Reconnect dalam ${delay / 1000}s (attempt #${reconnectAttempts})...`);
    
    reconnectTimeout = setTimeout(() => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        connectSSE();
      }
    }, delay);
  };
}

/**
 * Handle data notifikasi izin masuk:
 * - Deduplikasi in-memory & cross-tab
 * - Mainkan suara chime
 * - Emit custom event ke UI aplikasi
 * - Tampilkan notifikasi OS browser
 */
function handleIncomingLeaveNotification(data) {
  const leaveId = data.leaveId;
  const notifKey = leaveId ? `leave-${leaveId}` : `msg-${data.title}-${data.body}`;
  const now = Date.now();

  // Bersihkan cache in-memory yang sudah lewat 60 detik
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > 60000) {
      recentNotifications.delete(key);
    }
  }

  // 1. Cek deduplikasi in-memory (dalam tab yang sama)
  if (recentNotifications.has(notifKey) && now - recentNotifications.get(notifKey) < 8000) {
    console.log(`[Notif] ⏭️ Duplikat notifikasi diabaikan (memory tab): ${notifKey}`);
    return;
  }
  recentNotifications.set(notifKey, now);

  // 2. Emit event aplikasi untuk memperbarui UI in-app (semua tab aktif boleh update data UI-nya)
  window.dispatchEvent(new CustomEvent('app:leave-request', { detail: data }));

  // 3. Cek deduplikasi cross-tab via localStorage untuk notifikasi OS
  // Mencegah semua tab yang terbuka serentak memunculkan popup notifikasi OS ganda
  const storageKey = `admin_notif_seen_${notifKey}`;
  const lastSeenCrossTab = parseInt(localStorage.getItem(storageKey) || '0', 10);
  if (now - lastSeenCrossTab < 8000) {
    console.log(`[Notif] ⏭️ Notifikasi OS diabaikan karena sudah ditampilkan oleh tab lain: ${notifKey}`);
    return;
  }
  localStorage.setItem(storageKey, now.toString());
  setTimeout(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, 15000);

  // 4. Mainkan audio chime
  playNotificationChime();

  // 5. Tampilkan notifikasi browser
  showBrowserNotification(data.title, data.body, leaveId);
}

/**
 * Tampilkan notifikasi browser (OS-level notification).
 * @param {string} title
 * @param {string} body
 * @param {number|string} [leaveId]
 */
function showBrowserNotification(title, body, leaveId) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      // Gunakan tag deterministik berdasarkan leaveId agar browser otomatis me-replace duplicate jika terjadi
      const tagId = `leave-request-${leaveId || 'latest'}`;

      const notification = new Notification(title, {
        body,
        tag: tagId,
        renotify: true,
        requireInteraction: true,
      });

      notification.onshow = () => {
        console.log('[Notif] 🔔 Notifikasi browser berhasil ditampilkan di layar.');
      };

      notification.onerror = (err) => {
        console.warn('[Notif] ⚠️ Notifikasi browser error saat ditampilkan:', err);
      };

      // Klik notifikasi -> fokus ke tab & arahkan ke halaman izin
      notification.onclick = () => {
        window.focus();
        window.dispatchEvent(new CustomEvent('app:open-leaves-tab', { detail: { leaveId } }));
        notification.close();
      };
    } catch (err) {
      console.warn('[Notif] ⚠️ Gagal membuat objek Notification:', err);
    }
  } else {
    console.log('[Notif] Izin notifikasi browser belum aktif (status:', Notification.permission, ').');
  }
}

/**
 * Tutup koneksi SSE dan bersihkan resources.
 * Dipanggil saat admin logout.
 */
export function disconnectRealtimeNotification() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  reconnectAttempts = 0;
  isInitializing = false;
  console.log('[Notif] SSE disconnected.');
}
