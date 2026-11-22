const { pool } = require('../config/database');

/**
 * Model Location - Operasi database untuk tabel locations.
 * Menyimpan data GPS koordinat dan komponen alamat saat Clock In dan Clock Out.
 */
const Location = {
  /**
   * Buat tabel locations jika belum ada
   */
  createTable: async () => {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        attendance_id INT NOT NULL,
        latitude DOUBLE NOT NULL,
        longitude DOUBLE NOT NULL,
        alamat TEXT DEFAULT NULL,
        jalan VARCHAR(255) DEFAULT NULL,
        nomor VARCHAR(50) DEFAULT NULL,
        rt VARCHAR(20) DEFAULT NULL,
        rw VARCHAR(20) DEFAULT NULL,
        kelurahan VARCHAR(100) DEFAULT NULL,
        kecamatan VARCHAR(100) DEFAULT NULL,
        kabupaten VARCHAR(100) DEFAULT NULL,
        provinsi VARCHAR(100) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_attendance_id (attendance_id),
        CONSTRAINT fk_locations_attendance FOREIGN KEY (attendance_id) REFERENCES attendance_logs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },

  /**
   * Simpan data lokasi baru yang terhubung ke log absensi
   */
  create: async ({
    attendance_id,
    latitude,
    longitude,
    alamat = null,
    jalan = null,
    nomor = null,
    rt = null,
    rw = null,
    kelurahan = null,
    kecamatan = null,
    kabupaten = null,
    provinsi = null,
  }) => {
    const [result] = await pool.execute(
      `INSERT INTO locations 
       (attendance_id, latitude, longitude, alamat, jalan, nomor, rt, rw, kelurahan, kecamatan, kabupaten, provinsi) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attendance_id,
        latitude,
        longitude,
        alamat || null,
        jalan || null,
        nomor || null,
        rt || null,
        rw || null,
        kelurahan || null,
        kecamatan || null,
        kabupaten || null,
        provinsi || null,
      ]
    );

    return {
      id: result.insertId,
      attendance_id,
      latitude,
      longitude,
      alamat,
      jalan,
      nomor,
      rt,
      rw,
      kelurahan,
      kecamatan,
      kabupaten,
      provinsi,
    };
  },

  /**
   * Cari lokasi berdasarkan attendance_id
   */
  findByAttendanceId: async (attendanceId) => {
    const [rows] = await pool.execute(
      `SELECT * FROM locations WHERE attendance_id = ? LIMIT 1`,
      [attendanceId]
    );
    return rows[0] || null;
  },
};

module.exports = Location;
