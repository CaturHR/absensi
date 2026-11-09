const { pool } = require('../config/database');
const { getTodayRangeWIB } = require('../utils/dateHelper');

/**
 * Model Attendance - Operasi database untuk tabel attendance_logs.
 * Disederhanakan: tanpa geofencing / koordinat lokasi, tanpa verifikasi wajah AI / foto.
 */
const Attendance = {
  /**
   * Simpan log absensi baru (Clock In / Clock Out).
   * @param {object} param
   * @returns {Promise<object>}
   */
  create: async ({ user_id, status = 'Clock In', notes = null }) => {
    // Memasukkan log absensi (dengan fallback 0 / NULL untuk kompatibilitas jika kolom lama masih ada)
    const [result] = await pool.execute(
      `INSERT INTO attendance_logs (user_id, status, notes) VALUES (?, ?, ?)`,
      [user_id, status, notes || null]
    );

    return {
      id: result.insertId,
      user_id,
      status,
      notes,
    };
  },

  /**
   * Buat log presensi izin ketika permohonan disetujui
   */
  createLeaveLog: async ({ user_id, notes = 'Izin disetujui', attachment = null }) => {
    try {
      const [result] = await pool.execute(
        `INSERT INTO attendance_logs (user_id, status, notes, attachment) VALUES (?, 'Izin', ?, ?)`,
        [user_id, notes, attachment || null]
      );
      return { id: result.insertId, user_id, status: 'Izin', attachment };
    } catch (err) {
      // Fallback jika kolom attachment belum ada
      const [result] = await pool.execute(
        `INSERT INTO attendance_logs (user_id, status, notes) VALUES (?, 'Izin', ?)`,
        [user_id, notes]
      );
      return { id: result.insertId, user_id, status: 'Izin' };
    }
  },

  /**
   * Ambil semua log absensi (untuk admin web).
   * Join dengan tabel users untuk info nama, NIP, divisi, email.
   * @param {object} filters - { page, limit, user_id, status, date_from, date_to }
   * @returns {Promise<{ data: Array, total: number, page: number, totalPages: number }>}
   */
  findAll: async ({ page = 1, limit = 20, user_id, status, date_from, date_to } = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (user_id) {
      whereClause += ' AND a.user_id = ?';
      params.push(user_id);
    }
    if (status && status !== 'all') {
      if (status === 'Izin' || status.toLowerCase() === 'izin') {
        whereClause += " AND (a.status = 'Izin' OR a.notes LIKE 'Izin:%' OR a.notes LIKE 'Izin %')";
      } else if (status === 'Clock In') {
        whereClause += " AND a.status = 'Clock In' AND (a.notes IS NULL OR (a.notes NOT LIKE 'Izin:%' AND a.notes NOT LIKE 'Izin %'))";
      } else {
        whereClause += ' AND a.status = ?';
        params.push(status);
      }
    }
    if (date_from) {
      whereClause += ' AND DATE(a.created_at) >= ?';
      params.push(date_from);
    }
    if (date_to) {
      whereClause += ' AND DATE(a.created_at) <= ?';
      params.push(date_to);
    }

    // Hitung total data
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM attendance_logs a ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Pagination
    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT a.id, a.user_id,
              CASE 
                WHEN a.notes LIKE 'Izin:%' OR a.notes LIKE 'Izin %' THEN 'Izin'
                ELSE a.status 
              END as status,
              a.notes, a.created_at,
              u.name as user_name, u.nip as user_nip,
              u.email as user_email, u.divisi,
              (
                SELECT lr.attachment 
                FROM leave_requests lr 
                WHERE lr.user_id = a.user_id 
                  AND DATE(lr.created_at) = DATE(a.created_at)
                  AND lr.attachment IS NOT NULL 
                  AND lr.attachment != ''
                ORDER BY lr.id DESC 
                LIMIT 1
              ) as attachment
       FROM attendance_logs a
       LEFT JOIN users u ON a.user_id = u.id
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
   * Ambil riwayat absensi berdasarkan user_id (untuk mobile).
   * @param {number} userId
   * @param {object} options - { page, limit }
   * @returns {Promise<{ data: Array, total: number, page: number, totalPages: number }>}
   */
  findByUserId: async (userId, { page = 1, limit = 20 } = {}) => {
    const [countResult] = await pool.execute(
      "SELECT COUNT(*) as total FROM attendance_logs WHERE user_id = ? AND (status IN ('Clock In', 'Clock Out', 'Izin') OR notes LIKE 'Izin:%')",
      [userId]
    );
    const total = countResult[0].total;

    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT a.id, a.user_id,
              CASE 
                WHEN a.notes LIKE 'Izin:%' OR a.notes LIKE 'Izin %' THEN 'Izin'
                ELSE a.status 
              END as status,
              a.notes, a.created_at,
              (
                SELECT lr.attachment 
                FROM leave_requests lr 
                WHERE lr.user_id = a.user_id 
                  AND DATE(lr.created_at) = DATE(a.created_at)
                  AND lr.attachment IS NOT NULL 
                  AND lr.attachment != ''
                ORDER BY lr.id DESC 
                LIMIT 1
              ) as attachment
       FROM attendance_logs a
       WHERE a.user_id = ? AND (a.status IN ('Clock In', 'Clock Out', 'Izin') OR a.notes LIKE 'Izin:%')
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
      `SELECT a.id, a.user_id,
              CASE 
                WHEN a.notes LIKE 'Izin:%' OR a.notes LIKE 'Izin %' THEN 'Izin'
                ELSE a.status 
              END as status,
              a.notes, a.created_at,
              u.name as user_name, u.nip as user_nip, u.divisi,
              (
                SELECT lr.attachment 
                FROM leave_requests lr 
                WHERE lr.user_id = a.user_id 
                  AND DATE(lr.created_at) = DATE(a.created_at)
                  AND lr.attachment IS NOT NULL 
                  AND lr.attachment != ''
                ORDER BY lr.id DESC 
                LIMIT 1
              ) as attachment
       FROM attendance_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Mengambil status Clock In & Clock Out user untuk hari ini.
   * Rentang waktu harian: 00:00:00 s/d 23:59:59 WIB.
   * @param {number} userId
   * @returns {Promise<object>}
   */
  getTodayStatus: async (userId) => {
    // Jalankan auto clock-out untuk menutup presensi hari-hari sebelumnya jika ada yang belum di-clock out
    await Attendance.autoClockOut(userId);

    const { startOfDay, endOfDay } = getTodayRangeWIB();
    const [rows] = await pool.execute(
      `SELECT id, user_id, status, notes, created_at FROM attendance_logs 
       WHERE user_id = ? 
         AND created_at >= ? 
         AND created_at <= ? 
         AND (status IN ('Clock In', 'Clock Out', 'Izin') OR notes LIKE 'Izin:%')
       ORDER BY created_at ASC`,
      [userId, startOfDay, endOfDay]
    );

    const clockIn = rows.find((r) => r.status === 'Clock In' && (!r.notes || !r.notes.startsWith('Izin:'))) || null;
    const clockOut = rows.find((r) => r.status === 'Clock Out') || null;
    const leaveLog = rows.find((r) => r.status === 'Izin' || (r.notes && r.notes.startsWith('Izin:'))) || null;

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
   * Otomatis melakukan Clock Out untuk karyawan yang lupa Clock Out hari sebelumnya.
   * @param {number} [userId]
   * @returns {Promise<number>}
   */
  autoClockOut: async (userId = null) => {
    try {
      const { startOfDay } = getTodayRangeWIB();
      let query = `
        SELECT cin.id, cin.user_id, cin.created_at
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
        const d = new Date(item.created_at);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const autoClockOutTime = `${yyyy}-${mm}-${dd} 23:59:00`;

        await pool.execute(
          `INSERT INTO attendance_logs (user_id, status, notes, created_at)
           VALUES (?, 'Clock Out', 'Auto Clock Out oleh sistem', ?)`,
          [item.user_id, autoClockOutTime]
        );
        createdCount++;
      }

      return createdCount;
    } catch (err) {
      console.error('⚠️ Error in autoClockOut:', err.message);
      return 0;
    }
  },
};

module.exports = Attendance;
