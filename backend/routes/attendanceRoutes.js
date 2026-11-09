const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');

/**
 * Routes Absensi:
 * POST   /api/attendance          - Submit absensi (Clock In / Clock Out, tanpa AI & tanpa lokasi)
 * GET    /api/attendance          - Ambil semua log absensi (admin web only)
 * GET    /api/attendance/history  - Riwayat absensi user yang login (mobile)
 * GET    /api/attendance/today    - Status absensi hari ini (Clock In & Clock Out)
 * GET    /api/attendance/:id      - Detail absensi
 */

// Submit absensi - User menekan tombol Clock In atau Clock Out
router.post('/', authMiddleware, attendanceController.submitAttendance);

// Riwayat absensi user yang sedang login (mobile)
router.get('/history', authMiddleware, attendanceController.getMyHistory);

// Semua log absensi (admin web: hanya melihat log absen)
router.get('/', authMiddleware, adminOnly, attendanceController.getAllAttendance);

// Status absensi hari ini
router.get('/today', authMiddleware, attendanceController.getTodayStatus);

// Detail absensi
router.get('/:id', authMiddleware, attendanceController.getAttendanceById);

module.exports = router;
