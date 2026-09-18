const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Pool koneksi MySQL dengan promise support.
 * Menggunakan connection pool agar efisien untuk concurrent requests.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'absensi_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Timezone UTC agar konsisten
  timezone: '+00:00',
});

/**
 * Test koneksi database saat startup.
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database MySQL terhubung.');
    connection.release();
  } catch (error) {
    console.error('❌ Gagal terhubung ke database:', error.message);
    process.exit(1);
  }
};

module.exports = { pool, testConnection };
