/**
 * SSE (Server-Sent Events) Manager untuk notifikasi real-time.
 * 
 * Admin yang terkoneksi akan menerima event secara langsung
 * tanpa bergantung pada layanan push pihak ketiga (FCM/APNS).
 */

// Menyimpan semua koneksi SSE admin yang aktif
// Map<userId, Set<Response>>
const activeConnections = new Map();

/**
 * Tambahkan koneksi SSE baru untuk admin.
 * @param {number} userId
 * @param {object} res - Express response object
 */
function addConnection(userId, res) {
  if (!activeConnections.has(userId)) {
    activeConnections.set(userId, new Set());
  }
  activeConnections.get(userId).add(res);
  console.log(`📡 SSE: Admin ${userId} terhubung. Total koneksi: ${getTotalConnections()}`);
}

/**
 * Hapus koneksi SSE.
 * @param {number} userId
 * @param {object} res - Express response object
 */
function removeConnection(userId, res) {
  const connections = activeConnections.get(userId);
  if (connections) {
    connections.delete(res);
    if (connections.size === 0) {
      activeConnections.delete(userId);
    }
  }
  console.log(`📡 SSE: Admin ${userId} terputus. Total koneksi: ${getTotalConnections()}`);
}

/**
 * Hitung total koneksi aktif.
 */
function getTotalConnections() {
  let total = 0;
  for (const conns of activeConnections.values()) {
    total += conns.size;
  }
  return total;
}

/**
 * Kirim event ke SEMUA admin yang sedang terhubung via SSE.
 * @param {string} eventName - Nama event (e.g., 'leave-request')
 * @param {object} data - Data yang dikirim
 */
function broadcastToAdmins(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  let sentCount = 0;

  for (const [userId, connections] of activeConnections.entries()) {
    const deadConnections = [];
    for (const res of connections) {
      if (res.writableEnded || res.destroyed) {
        deadConnections.push(res);
        continue;
      }
      try {
        res.write(payload);
        sentCount++;
      } catch (err) {
        console.error(`📡 SSE: Gagal kirim ke admin ${userId}:`, err.message);
        deadConnections.push(res);
      }
    }
    for (const deadRes of deadConnections) {
      connections.delete(deadRes);
    }
    if (connections.size === 0) {
      activeConnections.delete(userId);
    }
  }

  console.log(`📡 SSE: Event "${eventName}" dikirim ke ${sentCount} koneksi admin.`);
}

module.exports = { addConnection, removeConnection, broadcastToAdmins };
