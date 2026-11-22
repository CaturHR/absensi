const { pool } = require('./database');
const Location = require('../models/Location');
const LeaveRequest = require('../models/LeaveRequest');

/**
 * Sinkronisasi struktur database:
 * 1. users
 * 2. attendance_logs
 * 3. leave_requests (dengan status pending default & reject_reason)
 * 4. locations (GPS tracking & alamat lengkap)
 */
async function syncDatabase() {
  try {
    // 1. Pastikan tabel users & kolomnya sesuai
    try {
      await pool.execute(`ALTER TABLE users MODIFY COLUMN face_photo VARCHAR(255) NULL DEFAULT NULL`);
    } catch (_) {}

    // 2. Pastikan tabel attendance_logs memiliki kolom yang diperlukan
    try {
      await pool.execute(`
        ALTER TABLE attendance_logs 
        MODIFY COLUMN latitude DOUBLE NULL DEFAULT 0,
        MODIFY COLUMN longitude DOUBLE NULL DEFAULT 0,
        MODIFY COLUMN status ENUM('Clock In', 'Clock Out', 'Izin') NOT NULL DEFAULT 'Clock In'
      `);
    } catch (err) {
      console.warn('Catatan sinkronisasi kolom attendance_logs:', err.message);
    }

    // Pastikan kolom attachment ada di tabel attendance_logs untuk menyimpan lampiran izin
    try {
      const [cols] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'attendance_logs' 
          AND COLUMN_NAME = 'attachment'
      `);
      if (cols.length === 0) {
        await pool.execute(`ALTER TABLE attendance_logs ADD COLUMN attachment VARCHAR(500) NULL DEFAULT NULL AFTER notes`);
      }
    } catch (colErr) {
      console.warn('Catatan penambahan kolom attachment:', colErr.message);
    }

    // 3. Pastikan tabel leave_requests ada dengan default status 'pending' dan reject_reason
    await LeaveRequest.createTable();

    try {
      // Pastikan default status adalah 'pending'
      await pool.execute(`
        ALTER TABLE leave_requests 
        MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending'
      `);
    } catch (_) {}

    // Cek kolom reject_reason di leave_requests
    try {
      const [cols] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'leave_requests' 
          AND COLUMN_NAME = 'reject_reason'
      `);
      if (cols.length === 0) {
        await pool.execute(`ALTER TABLE leave_requests ADD COLUMN reject_reason TEXT NULL DEFAULT NULL AFTER status`);
        console.log('✅ Kolom reject_reason berhasil ditambahkan ke leave_requests.');
      }
    } catch (err) {
      console.warn('Catatan penambahan kolom reject_reason:', err.message);
    }

    // 4. Pastikan tabel locations ada untuk menyimpan koordinat GPS dan komponen alamat
    await Location.createTable();
    console.log('✅ Tabel locations siap digunakan.');

    // 5. Selaraskan status absensi: jika catatan mengandung 'Izin:', pastikan status adalah 'Izin'
    try {
      await pool.execute(`
        UPDATE attendance_logs 
        SET status = 'Izin' 
        WHERE (notes LIKE 'Izin:%' OR notes LIKE 'Izin %') AND status != 'Izin'
      `);
    } catch (statusErr) {
      console.warn('Catatan sinkronisasi status izin:', statusErr.message);
    }

  } catch (error) {
    console.error('⚠️ Peringatan saat sinkronisasi database:', error.message);
  }
}

module.exports = { syncDatabase };
