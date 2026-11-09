const { pool } = require('./database');

/**
 * Sinkronisasi struktur database agar hanya ada 3 tabel:
 * 1. users
 * 2. attendance_logs
 * 3. leave_requests
 *
 * Menghapus tabel `galleries` dan `locations`, serta merapikan kolom.
 */
async function syncDatabase() {
  try {

    // 1. Drop foreign key ke locations pada attendance_logs jika ada
    try {
      const [fkRows] = await pool.execute(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'attendance_logs' 
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      `);
      for (const row of fkRows) {
        if (row.CONSTRAINT_NAME.includes('location') || row.CONSTRAINT_NAME === 'attendance_logs_ibfk_2') {
          await pool.execute(`ALTER TABLE attendance_logs DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
          console.log(`🗑️ Foreign key '${row.CONSTRAINT_NAME}' berhasil dihapus.`);
        }
      }
    } catch (e) {
      // ignore
    }

    // 2. Drop tabel `galleries` dan `locations` jika masih ada
    await pool.execute('DROP TABLE IF EXISTS galleries');
    await pool.execute('DROP TABLE IF EXISTS locations');

    // 3. Pastikan kolom attendance_logs disederhanakan (jadikan NULL-able jika masih ada kolom lama agar aman)
    try {
      await pool.execute(`
        ALTER TABLE attendance_logs 
        MODIFY COLUMN latitude DOUBLE NULL DEFAULT 0,
        MODIFY COLUMN longitude DOUBLE NULL DEFAULT 0,
        MODIFY COLUMN distance DOUBLE NULL DEFAULT NULL,
        MODIFY COLUMN face_confidence DOUBLE NULL DEFAULT NULL,
        MODIFY COLUMN photo VARCHAR(255) NULL DEFAULT NULL,
        MODIFY COLUMN location_id INT(11) NULL DEFAULT NULL,
        MODIFY COLUMN status ENUM('Clock In', 'Clock Out', 'Izin') NOT NULL DEFAULT 'Clock In'
      `);
    } catch (e) {
      // Jika enum status ada nilai lama, ubah dulu nilai lama
      try {
        await pool.execute("UPDATE attendance_logs SET status = 'Clock In' WHERE status NOT IN ('Clock In', 'Clock Out', 'Izin')");
        await pool.execute(`
          ALTER TABLE attendance_logs 
          MODIFY COLUMN latitude DOUBLE NULL DEFAULT 0,
          MODIFY COLUMN longitude DOUBLE NULL DEFAULT 0,
          MODIFY COLUMN distance DOUBLE NULL DEFAULT NULL,
          MODIFY COLUMN face_confidence DOUBLE NULL DEFAULT NULL,
          MODIFY COLUMN photo VARCHAR(255) NULL DEFAULT NULL,
          MODIFY COLUMN location_id INT(11) NULL DEFAULT NULL,
          MODIFY COLUMN status ENUM('Clock In', 'Clock Out', 'Izin') NOT NULL DEFAULT 'Clock In'
        `);
      } catch (err2) {
        console.warn('Catatan sinkronisasi kolom attendance_logs:', err2.message);
      }
    }

    // 4. Pastikan users.face_photo nullable jika masih ada
    try {
      await pool.execute(`ALTER TABLE users MODIFY COLUMN face_photo VARCHAR(255) NULL DEFAULT NULL`);
    } catch (_) {}

    // 5. Pastikan tabel leave_requests ada dengan default status 'approved'
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        description TEXT,
        attachment VARCHAR(500),
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved',
        reviewed_by INT,
        reviewed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_leave_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_leave_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // 6. Pastikan default status leave_requests adalah 'approved'
    try {
      await pool.execute(`
        ALTER TABLE leave_requests 
        MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved'
      `);
      await pool.execute(`UPDATE leave_requests SET status = 'approved' WHERE status = 'pending'`);
    } catch (_) {}

    // 7. Pastikan kolom attachment ada di tabel attendance_logs untuk menyimpan lampiran izin
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

    // 8. Selaraskan status absensi: jika catatan mengandung 'Izin:', pastikan status adalah 'Izin'
    try {
      await pool.execute(`
        UPDATE attendance_logs 
        SET status = 'Izin' 
        WHERE (notes LIKE 'Izin:%' OR notes LIKE 'Izin %') AND status != 'Izin'
      `);
    } catch (statusErr) {
      console.warn('Catatan sinkronisasi status izin:', statusErr.message);
    }

    // 9. Sinkronkan file lampiran dari tabel leave_requests ke attendance_logs
    try {
      await pool.execute(`
        UPDATE attendance_logs a
        JOIN leave_requests lr ON lr.user_id = a.user_id AND DATE(lr.created_at) = DATE(a.created_at)
        SET a.attachment = lr.attachment
        WHERE (a.status = 'Izin' OR a.notes LIKE 'Izin:%')
          AND lr.attachment IS NOT NULL 
          AND lr.attachment != ''
          AND (a.attachment IS NULL OR a.attachment = '')
      `);
    } catch (attErr) {
      console.warn('Catatan sinkronisasi attachment izin:', attErr.message);
    }

  } catch (error) {
    console.error('⚠️ Peringatan saat sinkronisasi database:', error.message);
  }
}

module.exports = { syncDatabase };

