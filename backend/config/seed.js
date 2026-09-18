/**
 * Script untuk membuat akun admin pertama.
 * 
 * Jalankan setelah database dan tabel dibuat:
 *   node config/seed.js
 */
const bcrypt = require('bcryptjs');
const { pool, testConnection } = require('./database');

const seed = async () => {
  try {
    await testConnection();

    const adminPassword = 'admin123';
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Cek apakah admin sudah ada
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      ['admin@absensi.com']
    );

    if (existing.length > 0) {
      console.log('⚠️  Admin sudah ada, memperbarui password...');
      await pool.execute(
        'UPDATE users SET password = ? WHERE email = ?',
        [hashedPassword, 'admin@absensi.com']
      );
      console.log('✅ Password admin berhasil diperbarui.');
    } else {
      await pool.execute(
        'INSERT INTO users (name, email, nip, password, role) VALUES (?, ?, ?, ?, ?)',
        ['Administrator', 'admin@absensi.com', 'ADMIN001', hashedPassword, 'admin']
      );
      console.log('✅ Akun admin berhasil dibuat.');
    }

    // Seed lokasi default jika belum ada
    const [locations] = await pool.execute('SELECT id FROM locations LIMIT 1');
    if (locations.length === 0) {
      await pool.execute(
        'INSERT INTO locations (name, latitude, longitude, radius, is_active) VALUES (?, ?, ?, ?, ?)',
        ['Kantor Pusat', -6.200000, 106.816666, 100, 1]
      );
      console.log('✅ Lokasi default berhasil ditambahkan.');
    } else {
      console.log('⚠️  Lokasi sudah ada, skip.');
    }

    console.log('\n📋 Kredensial Admin:');
    console.log('   Email   : admin@absensi.com');
    console.log('   Password: admin123');
    console.log('\n⚠️  Ganti password ini di production!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed gagal:', error.message);
    process.exit(1);
  }
};

seed();
