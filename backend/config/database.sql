-- ============================================
-- Database Schema untuk Sistem Absensi
-- ============================================
-- Jalankan query ini di MySQL untuk membuat database dan tabel.

CREATE DATABASE IF NOT EXISTS absensi_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE absensi_db;

-- ============================================
-- Tabel Users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  nip VARCHAR(50) NOT NULL UNIQUE COMMENT 'Nomor Induk Pegawai/Mahasiswa',
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  face_photo VARCHAR(255) DEFAULT NULL COMMENT 'Path relatif ke foto master wajah',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_nip (nip),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabel Locations (Lokasi Kantor/Kampus)
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT 'Nama lokasi (misal: Kantor Pusat, Kampus A)',
  latitude DOUBLE NOT NULL,
  longitude DOUBLE NOT NULL,
  radius INT DEFAULT 100 COMMENT 'Radius geofencing dalam meter',
  is_active TINYINT(1) DEFAULT 1 COMMENT '1 = aktif, 0 = nonaktif',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Tabel Attendance Logs
-- ============================================
CREATE TABLE IF NOT EXISTS attendance_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  latitude DOUBLE NOT NULL COMMENT 'Latitude lokasi user saat absensi',
  longitude DOUBLE NOT NULL COMMENT 'Longitude lokasi user saat absensi',
  distance DOUBLE DEFAULT NULL COMMENT 'Jarak ke lokasi kantor (meter)',
  face_confidence DOUBLE DEFAULT NULL COMMENT 'Confidence score face comparison (0-100)',
  status ENUM('Hadir', 'Di Luar Radius', 'Wajah Tidak Cocok', 'Gagal Verifikasi Wajah') NOT NULL,
  type ENUM('in', 'out') DEFAULT 'in' COMMENT 'in = Clock In, out = Clock Out',
  photo VARCHAR(255) DEFAULT NULL COMMENT 'Path relatif ke foto absensi',
  location_id INT DEFAULT NULL COMMENT 'Lokasi kantor/kampus yang digunakan saat absensi',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_user_date (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Data Awal: Admin Default
-- ============================================
-- Password: admin123 (bcrypt hash, 12 rounds)
INSERT INTO users (name, email, nip, password, role) VALUES
('Administrator', 'admin@absensi.com', 'ADMIN001', '$2a$12$LJ3lIvh5Xt5Hq5Z5X5X5X.5X5X5X5X5X5X5X5X5X5X5X5X5X5X', 'admin');

-- ============================================
-- Data Awal: Lokasi Contoh
-- ============================================
INSERT INTO locations (name, latitude, longitude, radius, is_active) VALUES
('Kantor Pusat', -6.200000, 106.816666, 100, 1);

-- CATATAN:
-- Password admin di atas adalah placeholder hash.
-- Untuk production, generate hash baru menggunakan:
--   node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 12).then(h => console.log(h))"
-- Kemudian update query INSERT di atas dengan hash yang dihasilkan.
 