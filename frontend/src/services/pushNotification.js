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
const MAX_RECONNECT_DELAY = 30000; // 30 detik max

/**
 * Inisialisasi notifikasi real-time untuk admin.
 * 1. Minta izin notifikasi browser
 * 2. Buka koneksi SSE ke backend
 * 3. Tampilkan notifikasi saat ada event masuk
 * 
 * @returns {Promise<{status: string, message: string}>}
 */
export async function initRealtimeNotification() {
  console.log('[Notif] Memulai inisialisasi notifikasi real-time...');

  // 1. Minta izin notifikasi browser
  if ('Notification' in window) {
    const currentPermission = Notification.permission;
    console.log('[Notif] Izin notifikasi saat ini:', currentPermission);

    if (currentPermission === 'default') {
      console.log('[Notif] Meminta izin notifikasi...');
      const permission = await Notification.requestPermission();
      console.log('[Notif] Hasil permintaan izin:', permission);
      if (permission !== 'granted') {
        console.log('[Notif] Izin notifikasi ditolak, melanjutkan tanpa notifikasi OS.');
      }
    }
  }

  // 2. Buka koneksi SSE
  connectSSE();

  return { status: 'connected', message: 'Notifikasi real-time aktif.' };
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

  // Tutup koneksi lama jika ada
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  // EventSource standar tidak mendukung custom headers (Authorization).
  // Workaround: kirim token via query parameter.
  const sseUrl = `/api/notifications/stream?token=${encodeURIComponent(token)}`;
  
  console.log('[Notif] Membuka koneksi SSE...');
  eventSource = new EventSource(sseUrl);

  // Event: Koneksi berhasil
  eventSource.addEventListener('connected', (event) => {
    console.log('[Notif] ✅ SSE terhubung:', JSON.parse(event.data));
    reconnectAttempts = 0; // Reset counter
  });

  // Event: Permohonan izin baru
  eventSource.addEventListener('leave-request', (event) => {
    console.log('[Notif] 📋 Event leave-request diterima:', event.data);
    try {
      const data = JSON.parse(event.data);
      showBrowserNotification(data.title, data.body);
    } catch (e) {
      console.error('[Notif] Error parsing leave-request event:', e);
    }
  });

  // Event: Error / koneksi terputus
  eventSource.onerror = (error) => {
    console.warn('[Notif] ⚠️ SSE error/disconnected:', error);
    eventSource.close();
    eventSource = null;

    // Auto-reconnect dengan exponential backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    console.log(`[Notif] Reconnect dalam ${delay / 1000}s (attempt #${reconnectAttempts})...`);
    
    reconnectTimeout = setTimeout(() => {
      const token = localStorage.getItem('token');
      if (token) {
        connectSSE();
      }
    }, delay);
  };
}

/**
 * Tampilkan notifikasi browser (OS-level notification).
 * @param {string} title
 * @param {string} body
 */
function showBrowserNotification(title, body) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'leave-request-' + Date.now(),
      requireInteraction: true,
    });

    // Klik notifikasi -> fokus ke tab
    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    console.log('[Notif] 🔔 Notifikasi browser ditampilkan.');
  } else {
    console.log('[Notif] Izin notifikasi belum diberikan, tidak menampilkan notifikasi OS.');
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
  console.log('[Notif] SSE disconnected.');
}
