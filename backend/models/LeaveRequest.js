const { pool } = require('../config/database');

/**
 * Model LeaveRequest - Operasi database untuk tabel leave_requests.
 * Menyimpan permohonan izin karyawan beserta file lampiran.
 */
const LeaveRequest = {
  /**
   * Buat tabel leave_requests jika belum ada.
   */
  createTable: async () => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        description TEXT,
        attachment VARCHAR(500),
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        reviewed_by INT,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
  },

  /**
   * Simpan permohonan izin baru.
   * @param {object} data - { user_id, reason, description, attachment }
   * @returns {Promise<object>}
   */
  create: async ({ user_id, reason, description, attachment }) => {
    const [result] = await pool.execute(
      `INSERT INTO leave_requests (user_id, reason, description, attachment) VALUES (?, ?, ?, ?)`,
      [user_id, reason, description || null, attachment || null]
    );
    return {
      id: result.insertId,
      user_id,
      reason,
      description,
      attachment,
      status: 'pending',
    };
  },

  /**
   * Ambil semua permohonan izin (untuk admin).
   * Join dengan tabel users untuk info nama karyawan.
   * @param {object} filters - { page, limit, status }
   * @returns {Promise<{ data: Array, total: number, page: number, totalPages: number }>}
   */
  findAll: async ({ page = 1, limit = 20, status } = {}) => {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      whereClause += ' AND lr.status = ?';
      params.push(status);
    }

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM leave_requests lr ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT lr.*, u.name as user_name, u.nip as user_nip, u.email as user_email,
              r.name as reviewer_name
       FROM leave_requests lr
       LEFT JOIN users u ON lr.user_id = u.id
       LEFT JOIN users r ON lr.reviewed_by = r.id
       ${whereClause}
       ORDER BY lr.created_at DESC
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
   * Ambil permohonan izin berdasarkan user_id (untuk karyawan).
   * @param {number} userId
   * @param {object} options - { page, limit }
   * @returns {Promise<{ data: Array, total: number }>}
   */
  findByUserId: async (userId, { page = 1, limit = 20 } = {}) => {
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM leave_requests WHERE user_id = ?',
      [userId]
    );
    const total = countResult[0].total;

    const offset = (page - 1) * limit;
    const [rows] = await pool.execute(
      `SELECT lr.*, r.name as reviewer_name
       FROM leave_requests lr
       LEFT JOIN users r ON lr.reviewed_by = r.id
       WHERE lr.user_id = ?
       ORDER BY lr.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit.toString(), offset.toString()]
    );

    return { data: rows, total, page, totalPages: Math.ceil(total / limit) };
  },

  /**
   * Ambil detail permohonan izin berdasarkan ID.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  findById: async (id) => {
    const [rows] = await pool.execute(
      `SELECT lr.*, u.name as user_name, u.nip as user_nip, u.email as user_email,
              r.name as reviewer_name
       FROM leave_requests lr
       LEFT JOIN users u ON lr.user_id = u.id
       LEFT JOIN users r ON lr.reviewed_by = r.id
       WHERE lr.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Update status permohonan izin (approve / reject).
   * @param {number} id
   * @param {string} status - 'approved' atau 'rejected'
   * @param {number} reviewedBy - ID admin yang mereview
   * @returns {Promise<object>}
   */
  updateStatus: async (id, status, reviewedBy) => {
    const [result] = await pool.execute(
      `UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [status, reviewedBy, id]
    );
    return result;
  },
};

module.exports = LeaveRequest;
