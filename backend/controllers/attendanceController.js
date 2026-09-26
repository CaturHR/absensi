const path = require('path');
const fs = require('fs');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Location = require('../models/Location');
const haversine = require('../utils/haversine');
const { compareFaces } = require('../utils/faceRecognition');
const { UPLOAD_DIR_FACES } = require('../config/multer');

/**
 * AttendanceController - Menangani seluruh logika absensi.
 */
const attendanceController = {
  /**
   * POST /api/attendance
   * Proses absensi: upload foto, geofencing, face recognition, simpan log.
   *
   * Flow:
   *   1. Validasi JWT (sudah dilakukan oleh authMiddleware)
   *   2. Validasi koordinat (latitude & longitude)
   *   3. Ambil lokasi kantor/kampus dari database
   *   4. Hitung jarak menggunakan Haversine
   *   5. Jika di luar radius → status "Di Luar Radius"
   *   6. Jika dalam radius → bandingkan wajah dengan foto master
   *   7. Jika wajah cocok → status "Hadir"
   *   8. Jika tidak cocok → status "Wajah Tidak Cocok"
   *   9. Simpan log absensi
   */
  submitAttendance: async (req, res, next) => {
    try {
      const userId = req.user.id;

      // ──────────────────────────────────────────────
      // 1. Validasi tipe absensi ('in' atau 'out')
      // ──────────────────────────────────────────────
      const type = (req.body.type || 'in').toLowerCase();
      if (!['in', 'out'].includes(type)) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Tipe presensi tidak valid. Harus "in" (Clock In) atau "out" (Clock Out).',
        });
      }

      // ──────────────────────────────────────────────
      // 2. Validasi Aturan Harian (1x per hari per aksi)
      // ──────────────────────────────────────────────
      const todayStatus = await Attendance.getTodayStatus(userId);

      if (type === 'in' && todayStatus.hasClockedIn) {
        if (req.file) fs.unlinkSync(req.file.path);
        const inTime = new Date(todayStatus.clockIn.created_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return res.status(400).json({
          success: false,
          message: `Anda sudah melakukan Clock In hari ini pada pukul ${inTime}.`,
        });
      }

      if (type === 'out') {
        if (!todayStatus.hasClockedIn) {
          if (req.file) fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            message: 'Anda belum melakukan Clock In hari ini. Silakan Clock In terlebih dahulu.',
          });
        }
        if (todayStatus.hasClockedOut) {
          if (req.file) fs.unlinkSync(req.file.path);
          const outTime = new Date(todayStatus.clockOut.created_at).toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return res.status(400).json({
            success: false,
            message: `Anda sudah melakukan Clock Out hari ini pada pukul ${outTime}.`,
          });
        }
      }

      // ──────────────────────────────────────────────
      // 3. Validasi file foto
      // ──────────────────────────────────────────────
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Foto wajah wajib diunggah.',
        });
      }

      // ──────────────────────────────────────────────
      // 4. Validasi koordinat GPS
      // ──────────────────────────────────────────────
      const { latitude, longitude } = req.body;

      if (!latitude || !longitude) {
        // Hapus file yang sudah diupload jika validasi gagal
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Latitude dan longitude wajib disertakan.',
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Latitude dan longitude harus berupa angka yang valid.',
        });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Koordinat di luar rentang valid. Latitude: -90 s/d 90, Longitude: -180 s/d 180.',
        });
      }

      // ──────────────────────────────────────────────
      // 3. Ambil lokasi kantor/kampus dari database
      // ──────────────────────────────────────────────
      const location = await Location.getActive();

      if (!location) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Lokasi kantor/kampus belum dikonfigurasi. Hubungi admin.',
        });
      }

      // ──────────────────────────────────────────────
      // 4. Hitung jarak menggunakan Haversine
      // ──────────────────────────────────────────────
      const distance = haversine(lat, lng, location.latitude, location.longitude);
      const radius = location.radius || parseInt(process.env.DEFAULT_RADIUS_METERS, 10) || 100;

      // ──────────────────────────────────────────────
      // 5. Cek geofencing - Jika di luar radius
      // ──────────────────────────────────────────────
      if (distance > radius) {
        // Simpan log dengan status "Di Luar Radius"
        const photoRelativePath = `attendance/${req.file.filename}`;

        const attendanceLog = await Attendance.create({
          user_id: userId,
          latitude: lat,
          longitude: lng,
          distance,
          face_confidence: null,
          status: 'Di Luar Radius',
          photo: photoRelativePath,
          location_id: location.id,
        });

        return res.status(200).json({
          success: false,
          message: `Anda berada di luar radius. Jarak Anda: ${distance} meter, radius maksimum: ${radius} meter.`,
          data: {
            id: attendanceLog.id,
            status: 'Di Luar Radius',
            distance,
            radius,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // ──────────────────────────────────────────────
      // 6. Face Recognition (DINONAKTIFKAN SESUAI PERMINTAAN USER)
      // Foto selfie real-time tetap disimpan sebagai bukti presensi,
      // tetapi proses komparasi wajah dilewati (bypass) dan status langsung "Hadir".
      // ──────────────────────────────────────────────
      const faceConfidence = 100.0;
      const faceStatus = type === 'in' ? 'Clock In' : 'Clock Out';

      // ──────────────────────────────────────────────
      // 7 & 8. Simpan log absensi dengan status final
      // ──────────────────────────────────────────────
      const photoRelativePath = `attendance/${req.file.filename}`;

      const attendanceLog = await Attendance.create({
        user_id: userId,
        latitude: lat,
        longitude: lng,
        distance,
        face_confidence: faceConfidence,
        status: faceStatus,
        photo: photoRelativePath,
        location_id: location.id,
      });

      // ──────────────────────────────────────────────
      // 9. Response
      // ──────────────────────────────────────────────
      const isSuccess = faceStatus === 'Clock In' || faceStatus === 'Clock Out';
      const statusCode = 200;
      const actionLabel = type === 'in' ? 'Clock In' : 'Clock Out';
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

      return res.status(statusCode).json({
        success: isSuccess,
        message: isSuccess
          ? `${actionLabel} berhasil pada pukul ${timeStr}.`
          : `${actionLabel} gagal. Wajah tidak cocok (confidence: ${faceConfidence}%).`,
        data: {
          id: attendanceLog.id,
          status: faceStatus,
          time: timeStr,
          distance,
          radius,
          face_confidence: faceConfidence,
          photo: photoRelativePath,
          location: location.name,
          timestamp: now.toISOString(),
        },
      });
    } catch (error) {
      // Cleanup file jika terjadi error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  },

  /**
   * GET /api/attendance/history
   * Ambil riwayat absensi user yang sedang login.
   */
  getMyHistory: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;

      const result = await Attendance.findByUserId(userId, { page, limit });

      return res.status(200).json({
        success: true,
        message: 'Riwayat absensi berhasil diambil.',
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/attendance
   * Ambil semua log absensi (admin only).
   * Query params: page, limit, user_id, status, date_from, date_to
   */
  getAllAttendance: async (req, res, next) => {
    try {
      const { page, limit, user_id, status, date_from, date_to } = req.query;

      const result = await Attendance.findAll({
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 20,
        user_id: user_id ? parseInt(user_id, 10) : undefined,
        status,
        date_from,
        date_to,
      });

      return res.status(200).json({
        success: true,
        message: 'Data absensi berhasil diambil.',
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit: parseInt(limit, 10) || 20,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/attendance/:id
   * Ambil detail absensi berdasarkan ID.
   */
  getAttendanceById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const attendance = await Attendance.findById(parseInt(id, 10));

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Data absensi tidak ditemukan.',
        });
      }

      // User biasa hanya bisa lihat absensinya sendiri
      if (req.user.role !== 'admin' && attendance.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses ke data absensi ini.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Detail absensi berhasil diambil.',
        data: attendance,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/attendance/today
   * Ambil status Clock In & Clock Out user yang sedang login untuk hari ini.
   */
  getTodayStatus: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const status = await Attendance.getTodayStatus(userId);
      return res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = attendanceController;
