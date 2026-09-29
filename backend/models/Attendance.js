const { pool } = require('../config/database');

/**
 * Model Attendance - Operasi database untuk tabel attendance_logs.
 */
const Attendance = {
  /**
   * Simpan log absensi baru.
   * @param {object} data
   * @returns {Promise<object>}
   */
  create: async ({
    user_id,
    latitude,
    longitude,
    distance,
    face_confidence,
    status,
    photo,
    location_id,
  }) => {
    const [result] = await pool.execute(
      `INSERT INTO attendance_logs 
        (user_id, latitude, longitude, distance, face_confidence, status, photo, location_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, latitude, longitude, distance, face_confidence, status, photo, location_id]
    );
    return {
      id: result.insertId,
      user_id,
      latitude,
      longitude,
      distance,
      face_confidence,
      status,
      photo,
      location_id,
    };
  },

  /**
   * Ambil semua log absensi (untuk admin).
   * Join dengan tabel users dan locations untuk info lengkap.
   * @param {object} filters - { page, limit, user_id, status, date_from, date_to }
   * @returns {Promise<{ data: Array, total: number, page: number, totalPages: number }>}
   */
  findAll: async ({ page = 1, limit = 20, user_id, status, date_from, date_to, location_id } = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (user_id) {
      whereClause += ' AND a.user_id = ?';
      params.push(user_id);
    }
    if (status) {
      whereClause += ' AND a.status = ?';
      params.push(status);
    }
    if (location_id) {
      whereClause += ' AND a.location_id = ?';
      params.push(location_id);
    }
    if (date_from) {
      whereClause += ' AND DATE(a.created_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND DATE(a.created_at) <= ?';
      params.push(date_to);
    }

    // Count total
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance_logs a ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Pagination
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT a.*, a.photo as attendance_photo, u.name as user_name, u.nip as user_nip, u.email as user_email,
              u.face_photo as master_photo, l.name as location_name
       FROM attendance_logs a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN locations l ON a.location_id = l.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit.toString(), offset.toString()]
    );

    return {
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Ambil riwayat absensi berdasarkan user_id.
   * @param {number} userId
   * @param {object} options - { page, limit }
   * @returns {Promise<{ data: Array, total: number, page: number, totalPages: number }>}
   */
  findByUserId: async (userId, { page = 1, limit = 20 } = {}) => {
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM attendance_logs WHERE user_id = ?',
      [userId]
    );
    const total = countResult[0].total;

    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT a.*, l.name as location_name
       FROM attendance_logs a
       LEFT JOIN locations l ON a.location_id = l.id
       WHERE a.user_id = ?
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit.toString(), offset.toString()]
    );

    return {
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Ambil detail absensi berdasarkan ID.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  findById: async (id) => {
    const [rows] = await pool.execute(
      `SELECT a.*, u.name as user_name, u.nip as user_nip,
              l.name as location_name
       FROM attendance_logs a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN locations l ON a.location_id = l.id
       WHERE a.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Cek apakah user sudah absen hari ini.
   * Rentang waktu harian: 00:00:00 s/d 23:59:59 WIB.
   * Reset terjadi otomatis tepat saat pergantian hari setelah pukul 23:59.
   * @param {number} userId
   * @returns {Promise<object|null>}
   */
  findTodayByUserId: async (userId) => {
    const { startOfDay, endOfDay } = getTodayRangeWIB();
    const [rows] = await pool.execute(
      `SELECT * FROM attendance_logs 
       WHERE user_id = ? AND created_at >= ? AND created_at <= ?
       ORDER BY created_at DESC LIMIT 1`,
      [userId, startOfDay, endOfDay]
    );
    return rows[0] || null;
  },

  /**
   * Mengambil status Clock In & Clock Out user untuk hari ini.
   * Rentang waktu harian: 00:00:00 s/d 23:59:59 WIB.
   * Reset presensi harian terjadi setelah jam 23:59 (memasuki hari selanjutnya).
   * @param {number} userId
   * @returns {Promise<{ clockIn: object|null, clockOut: object|null, hasClockedIn: boolean, hasClockedOut: boolean }>}
   */
  getTodayStatus: async (userId) => {
    const { startOfDay, endOfDay } = getTodayRangeWIB();
    const [rows] = await pool.execute(
      `SELECT id, user_id, status, created_at FROM attendance_logs 
       WHERE user_id = ? 
         AND created_at >= ? 
         AND created_at <= ? 
         AND status IN ('Clock In', 'Clock Out')
       ORDER BY created_at ASC`,
      [userId, startOfDay, endOfDay]
    );
    const clockIn = rows.find((r) => r.status === 'Clock In') || null;
    const clockOut = rows.find((r) => r.status === 'Clock Out') || null;

    const formatClockTime = (rec) => {
      if (!rec || !rec.created_at) return null;
      return new Date(rec.created_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).replace('.', ':');
    };

    return {
      clockIn: clockIn
        ? {
            ...clockIn,
            time: formatClockTime(clockIn),
          }
        : null,
      clockOut: clockOut
        ? {
            ...clockOut,
            time: formatClockTime(clockOut),
          }
        : null,
      hasClockedIn: !!clockIn,
      hasClockedOut: !!clockOut,
    };
  },
};

/**
 * Helper untuk mendapatkan rentang waktu hari ini dalam zona waktu Indonesia (WIB / Asia/Jakarta).
 * Hari ini dihitung mulai pukul 00:00:00 hingga pukul 23:59:59 WIB.
 * Tepat setelah pukul 23:59 (pukul 00:00:00 hari berikutnya), sistem otomatis mereset presensi ke hari baru.
 */
function getTodayRangeWIB() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
  const todayStr = formatter.format(now); // Format: YYYY-MM-DD
  const startOfDay = `${todayStr} 00:00:00`;
  const endOfDay = `${todayStr} 23:59:59`;
  return { todayStr, startOfDay, endOfDay };
}

module.exports = Attendance;
