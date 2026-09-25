const { pool } = require('../config/database');

/**
 * Model User - Operasi database untuk tabel users.
 */
const User = {
  /**
   * Cari user berdasarkan ID.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  findById: async (id) => {
    const [rows] = await pool.execute(
      'SELECT id, name, email, nip, role, face_photo, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Cari user berdasarkan email atau nama pengguna (mendukung tanpa @gmail.com).
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  findByEmail: async (email) => {
    if (!email) return null;
    const trimmed = email.trim();
    // Jika input berakhiran @gmail.com, buat versi tanpa @gmail.com
    // Jika input tidak mengandung @, buat versi dengan @gmail.com
    const withoutGmail = trimmed.toLowerCase().endsWith('@gmail.com')
      ? trimmed.slice(0, -10)
      : trimmed;
    const withGmail = trimmed.includes('@')
      ? trimmed
      : `${trimmed}@gmail.com`;

    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE email = ? OR email = ? OR email = ? ORDER BY (email = ?) DESC LIMIT 1',
      [trimmed, withGmail, withoutGmail, trimmed]
    );
    return rows[0] || null;
  },

  /**
   * Cari user berdasarkan NIP.
   * @param {string} nip
   * @returns {Promise<object|null>}
   */
  findByNip: async (nip) => {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE nip = ?',
      [nip]
    );
    return rows[0] || null;
  },

  /**
   * Ambil semua user (untuk admin).
   * @returns {Promise<Array>}
   */
  findAll: async () => {
    const [rows] = await pool.execute(
      'SELECT id, name, email, nip, role, face_photo, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return rows;
  },

  /**
   * Buat user baru.
   * @param {object} userData - { name, email, nip, password, role, face_photo }
   * @returns {Promise<object>}
   */
  create: async ({ name, email, nip, password, role = 'user', face_photo = null }) => {
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, nip, password, role, face_photo) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, nip, password, role, face_photo]
    );
    return { id: result.insertId, name, email, nip, role, face_photo };
  },

  /**
   * Update user.
   * @param {number} id
   * @param {object} data - Fields yang akan diupdate
   * @returns {Promise<object>}
   */
  update: async (id, data) => {
    const fields = [];
    const values = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) {
      throw new Error('Tidak ada data yang diupdate.');
    }

    values.push(id);
    const [result] = await pool.execute(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );
    return result;
  },

  /**
   * Hapus user.
   * @param {number} id
   * @returns {Promise<object>}
   */
  delete: async (id) => {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result;
  },

  /**
   * Ambil path foto master wajah user.
   * @param {number} userId
   * @returns {Promise<string|null>}
   */
  getFacePhoto: async (userId) => {
    const [rows] = await pool.execute(
      'SELECT face_photo FROM users WHERE id = ?',
      [userId]
    );
    return rows[0] ? rows[0].face_photo : null;
  },
};

module.exports = User;
