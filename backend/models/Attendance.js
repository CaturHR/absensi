const { pool } = require('../config/database');
const { getTodayRangeWIB } = require('../utils/dateHelper');

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
   * Buat log presensi izin ketika permohonan disetujui
   */
  createLeaveLog: async ({ user_id, reason = 'Izin' }) => {
    const [result] = await pool.execute(
      `INSERT INTO attendance_logs 
        (user_id, latitude, longitude, distance, face_confidence, status, photo, location_id) 
       VALUES (?, 0, 0, 0, 100, 'Izin', NULL, NULL)`,
      [user_id]
    );
    return { id: result.insertId, user_id, status: 'Izin' };
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
    // Jalankan auto clock-out untuk menutup presensi hari-hari sebelumnya yang belum di-clock out
    await Attendance.autoClockOut(userId);

    const { startOfDay, endOfDay } = getTodayRangeWIB();
    const [rows] = await pool.execute(
      `SELECT id, user_id, status, created_at FROM attendance_logs 
       WHERE user_id = ? 
         AND created_at >= ? 
         AND created_at <= ? 
         AND status IN ('Clock In', 'Clock Out', 'Izin')
       ORDER BY created_at ASC`,
      [userId, startOfDay, endOfDay]
    );
    const clockIn = rows.find((r) => r.status === 'Clock In') || null;
    const clockOut = rows.find((r) => r.status === 'Clock Out') || null;
    const leaveLog = rows.find((r) => r.status === 'Izin') || null;

    // Cek juga permohonan izin dari tabel leave_requests hari ini
    const [leaveRows] = await pool.execute(
      `SELECT id, user_id, reason, description, attachment, status, created_at FROM leave_requests
       WHERE user_id = ? 
         AND created_at >= ? 
         AND created_at <= ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId, startOfDay, endOfDay]
    );
    const todayLeaveRequest = leaveRows[0] || null;
    const hasLeaveToday = (todayLeaveRequest && todayLeaveRequest.status !== 'rejected') || !!leaveLog;

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
      hasLeaveToday: Boolean(hasLeaveToday),
      todayLeave: todayLeaveRequest
        ? {
            ...todayLeaveRequest,
            time: formatClockTime(todayLeaveRequest),
          }
        : (leaveLog ? { status: 'approved', reason: 'Izin', time: formatClockTime(leaveLog) } : null),
    };
  },

  /**
   * Otomatis melakukan Clock Out untuk karyawan yang lupa Clock Out.
   * Mencari semua data 'Clock In' yang belum memiliki pasangan 'Clock Out' pada tanggal yang sama.
   * @param {number} [userId] - Opsional, jika ingin memproses user tertentu saja.
   * @returns {Promise<number>} - Jumlah record Clock Out otomatis yang dibuat.
   */
  autoClockOut: async (userId = null) => {
    try {
      const { startOfDay } = getTodayRangeWIB();
      let query = `
        SELECT cin.id, cin.user_id, cin.location_id, cin.created_at, DATE(cin.created_at) as log_date
        FROM attendance_logs cin
        WHERE cin.status = 'Clock In'
          AND cin.created_at < ?
          AND NOT EXISTS (
            SELECT 1 FROM attendance_logs cout
            WHERE cout.user_id = cin.user_id
              AND cout.status = 'Clock Out'
              AND DATE(cout.created_at) = DATE(cin.created_at)
          )
      `;
      const params = [startOfDay];

      if (userId) {
        query += ' AND cin.user_id = ?';
        params.push(userId);
      }

      const [unclosed] = await pool.execute(query, params);
      let createdCount = 0;

      for (const item of unclosed) {
        // Format waktu auto clock out pada pukul 23:59:00 di tanggal absensi terkait
        const d = new Date(item.created_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const autoClockOutTime = `${yyyy}-${mm}-${dd} 23:59:00`;

        await pool.execute(
          `INSERT INTO attendance_logs 
            (user_id, latitude, longitude, distance, face_confidence, status, photo, location_id, created_at)
           VALUES (?, 0, 0, 0, 100, 'Clock Out', NULL, ?, ?)`,
          [item.user_id, item.location_id || null, autoClockOutTime]
        );
        createdCount++;
      }

      return createdCount;
    } catch (err) {
      console.error('⚠️ Error in autoClockOut:', err.message);
      return 0;
    }
  },

  /**
   * Update status verifikasi kehadiran / face approval.
   * @param {number} id
   * @param {object} param1 - { status, notes }
   * @returns {Promise<boolean>}
   */
  updateStatus: async (id, { status, notes }) => {
    const [result] = await pool.execute(
      'UPDATE attendance_logs SET status = ?, notes = ? WHERE id = ?',
      [status, notes || null, id]
    );
    return result.affectedRows > 0;
  },
};

module.exports = Attendance;
