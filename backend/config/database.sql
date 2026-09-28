-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Sep 25, 2026 at 09:25 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `absensi_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `attendance_logs`
--

CREATE TABLE `attendance_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `latitude` double NOT NULL COMMENT 'Latitude lokasi user saat absensi',
  `longitude` double NOT NULL COMMENT 'Longitude lokasi user saat absensi',
  `distance` double DEFAULT NULL COMMENT 'Jarak ke lokasi kantor (meter)',
  `face_confidence` double DEFAULT NULL COMMENT 'Confidence score face comparison (0-100)',
  `status` enum('Clock In','Clock Out','Di Luar Radius','Wajah Tidak Cocok','Gagal Verifikasi Wajah','Izin') NOT NULL,
  `photo` varchar(255) DEFAULT NULL COMMENT 'Path relatif ke foto absensi',
  `location_id` int(11) DEFAULT NULL COMMENT 'Lokasi kantor/kampus yang digunakan saat absensi',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `attachment` varchar(500) DEFAULT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `locations`
--

CREATE TABLE `locations` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Nama lokasi (misal: Kantor Pusat, Kampus A)',
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `radius` int(11) DEFAULT 100 COMMENT 'Radius geofencing dalam meter',
  `is_active` tinyint(1) DEFAULT 1 COMMENT '1 = aktif, 0 = nonaktif',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `locations`
--

INSERT INTO `locations` (`id`, `name`, `latitude`, `longitude`, `radius`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Kantor Pusat', -7.325066726186988, 112.72168235271651, 50, 1, '2026-09-24 04:56:31', '2026-09-24 04:56:31');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `nip` varchar(50) NOT NULL COMMENT 'Nomor Induk Pegawai/Mahasiswa',
  `password` varchar(255) NOT NULL,
  `role` enum('admin','user') DEFAULT 'user',
  `face_photo` varchar(255) DEFAULT NULL COMMENT 'Path relatif ke foto master wajah',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `nip`, `password`, `role`, `face_photo`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'admin@absensi.com', 'ADMIN001', '$2a$12$DxxwPtsPrLc85XHBxQiFWeBdq2b538RJM/Zp3KNy63ILV62SxSq9m', 'admin', NULL, '2026-09-24 04:56:31', '2026-09-24 08:09:21'),
(2, 'Nama Admin Baru', 'adminbaru@absensi.com', 'ADMIN002', '$2a$12$HKKq5VTESkW7/mcaTs7TMO5uoTX5l30cMiSQ2yjgqGCEf5/YcPhZW', 'admin', NULL, '2026-09-24 08:21:18', '2026-09-24 08:25:23'),
(3, 'catur', 'catur@gmail.com', '13213123', '$2a$12$jLSSBxbnGGFgXCfnFLUMJuRUfmNVD1iEZvMlXl5oVf.MUMOdTiofq', 'user', 'faces/1790304755407-3d74dc6cf17b609ea0cc466b397c33a7.jpg', '2026-09-25 02:52:36', '2026-09-25 02:52:36');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `location_id` (`location_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_user_date` (`user_id`,`created_at`);

--
-- Indexes for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `reviewed_by` (`reviewed_by`);

--
-- Indexes for table `locations`
--
ALTER TABLE `locations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `nip` (`nip`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_nip` (`nip`),
  ADD KEY `idx_role` (`role`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `leave_requests`
--
ALTER TABLE `leave_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `locations`
--
ALTER TABLE `locations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD CONSTRAINT `attendance_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `attendance_logs_ibfk_2` FOREIGN KEY (`location_id`) REFERENCES `locations` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `leave_requests_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
