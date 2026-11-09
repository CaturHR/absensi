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
      'SELECT id, name, email, nip, role, divisi, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Cari user berdasarkan email atau username.
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  findByEmail: async (email) => {
    if (!email) return null;
    const trimmed = email.trim();
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
   * Ambil semua user (untuk admin web).
   * @returns {Promise<Array>}
   */
  findAll: async () => {
    const [rows] = await pool.execute(
      'SELECT id, name, email, nip, role, divisi, created_at, updated_at FROM users ORDER BY id ASC'
    );
    return rows;
  },

  /**
   * Buat user baru.
   * @param {object} userData - { name, email, nip, password, role, divisi }
   * @returns {Promise<object>}
   */
  create: async ({ name, email, nip, password, role = 'user', divisi = null }) => {
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, nip, password, role, divisi) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, nip, password, role, divisi]
    );
    return { id: result.insertId, name, email, nip, role, divisi };
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
      if (value !== undefined && key !== 'face_photo') {
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
};

module.exports = User;
