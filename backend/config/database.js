const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Pool koneksi MySQL dengan konfigurasi optimal untuk server (RAM 8 GB).
 * Mendukung keep-alive, batas koneksi concurrent tinggi, dan auto-reconnect.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'absensi_db',
  waitForConnections: true,
  // Disesuaikan untuk server 8 GB (dapat menangani lonjakan concurrent absensi pagi hari)
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 30,
  maxIdle: parseInt(process.env.DB_MAX_IDLE, 10) || 10,
  idleTimeout: 60000, // 60 detik idle sebelum koneksi dilepas
  queueLimit: 0, // Antrean tidak terbatas
  // TCP Keep-Alive untuk mencegah timeout / ECONNRESET dari MySQL Server
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 detik
  connectTimeout: 10000, // 10 detik batas waktu koneksi awal
  // Timezone Indonesia (WIB / UTC+7) agar waktu sinkron
  timezone: '+07:00',
});

/**
 * Test koneksi database saat startup.
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT 1 + 1 AS result');
    connection.release();
    console.log(`✅ Database MySQL terhubung ke "${process.env.DB_NAME || 'absensi_db'}" (Pool Limit: ${pool.pool.config.connectionLimit}).`);
  } catch (error) {
    console.error('❌ Gagal terhubung ke database MySQL:', error.message);
    console.error('👉 Pastikan service MySQL/MariaDB aktif dan konfigurasi di .env sudah benar.');
    process.exit(1);
  }
};

module.exports = { pool, testConnection };

