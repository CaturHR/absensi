const { pool } = require('../config/database');

/**
 * Model Location - Operasi database untuk tabel locations (lokasi kantor/kampus).
 */
const Location = {
  /**
   * Ambil lokasi aktif (utama).
   * Jika ada beberapa lokasi, ambil yang aktif.
   * @returns {Promise<object|null>}
   */
  getActive: async () => {
    const [rows] = await pool.execute(
      'SELECT * FROM locations WHERE is_active = 1 LIMIT 1'
    );
    return rows[0] || null;
  },

  /**
   * Ambil semua lokasi.
   * @returns {Promise<Array>}
   */
  findAll: async () => {
    const [rows] = await pool.execute(
      'SELECT * FROM locations ORDER BY created_at DESC'
    );
    return rows;
  },

  /**
   * Cari lokasi berdasarkan ID.
   * @param {number} id
   * @returns {Promise<object|null>}
   */
  findById: async (id) => {
    const [rows] = await pool.execute('SELECT * FROM locations WHERE id = ?', [id]);
    return rows[0] || null;
  },

  /**
   * Buat lokasi baru.
   * @param {object} data - { name, latitude, longitude, radius, is_active }
   * @returns {Promise<object>}
   */
  create: async ({ name, latitude, longitude, radius, is_active = 1 }) => {
    // Jika lokasi baru aktif, nonaktifkan lokasi lain
    if (is_active) {
      await pool.execute('UPDATE locations SET is_active = 0');
    }

    const [result] = await pool.execute(
      'INSERT INTO locations (name, latitude, longitude, radius, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, latitude, longitude, radius, is_active]
    );
    return { id: result.insertId, name, latitude, longitude, radius, is_active };
  },

  /**
   * Update lokasi.
   * @param {number} id
   * @param {object} data
   * @returns {Promise<object>}
   */
  update: async (id, { name, latitude, longitude, radius, is_active }) => {
    // Jika diaktifkan, nonaktifkan yang lain
    if (is_active) {
      await pool.execute('UPDATE locations SET is_active = 0 WHERE id != ?', [id]);
    }

    const [result] = await pool.execute(
      `UPDATE locations SET name = ?, latitude = ?, longitude = ?, radius = ?, is_active = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, latitude, longitude, radius, is_active, id]
    );
    return result;
  },

  /**
   * Hapus lokasi.
   * @param {number} id
   * @returns {Promise<object>}
   */
  delete: async (id) => {
    const [result] = await pool.execute('DELETE FROM locations WHERE id = ?', [id]);
    return result;
  },
};

module.exports = Location;
