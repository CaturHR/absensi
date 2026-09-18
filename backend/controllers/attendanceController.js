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
      // 1. Validasi file foto
      // ──────────────────────────────────────────────
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Foto wajah wajib diunggah.',
        });
      }

      // ──────────────────────────────────────────────
      // 2. Validasi koordinat GPS
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
      // 6. Dalam radius → Ambil foto master & bandingkan wajah
      // ──────────────────────────────────────────────
      const facePhotoRelative = await User.getFacePhoto(userId);

      if (!facePhotoRelative) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Foto master wajah belum diunggah. Hubungi admin untuk mengupload foto wajah Anda.',
        });
      }

      const masterFacePath = path.join(UPLOAD_DIR_FACES, path.basename(facePhotoRelative));
      const attendanceFacePath = req.file.path;

      // Verifikasi file foto master ada
      if (!fs.existsSync(masterFacePath)) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'File foto master wajah tidak ditemukan di server. Hubungi admin.',
        });
      }

      let faceConfidence = 0;
      let faceStatus = 'Wajah Tidak Cocok';

      try {
        const faceResult = await compareFaces(masterFacePath, attendanceFacePath);
        faceConfidence = faceResult.confidence;

        // Gunakan threshold 1e-3 dari Face++ (paling lenient, ~62%)
        // Atau gunakan threshold kustom (misal 80%)
        const confidenceThreshold = faceResult.thresholds
          ? faceResult.thresholds['1e-3']
          : 60;

        if (faceConfidence >= confidenceThreshold) {
          faceStatus = 'Hadir';
        }
      } catch (faceError) {
        console.error('Face recognition error:', faceError.message);

        // Simpan log dengan error face recognition
        const photoRelativePath = `attendance/${req.file.filename}`;
        const attendanceLog = await Attendance.create({
          user_id: userId,
          latitude: lat,
          longitude: lng,
          distance,
          face_confidence: null,
          status: 'Gagal Verifikasi Wajah',
          photo: photoRelativePath,
          location_id: location.id,
        });

        return res.status(200).json({
          success: false,
          message: `Gagal memverifikasi wajah: ${faceError.message}`,
          data: {
            id: attendanceLog.id,
            status: 'Gagal Verifikasi Wajah',
            distance,
            timestamp: new Date().toISOString(),
          },
        });
      }

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
      const isSuccess = faceStatus === 'Hadir';
      const statusCode = 200;

      return res.status(statusCode).json({
        success: isSuccess,
        message: isSuccess
          ? 'Absensi berhasil! Status: Hadir.'
          : `Absensi gagal. Wajah tidak cocok (confidence: ${faceConfidence}%).`,
        data: {
          id: attendanceLog.id,
          status: faceStatus,
          distance,
          radius,
          face_confidence: faceConfidence,
          photo: photoRelativePath,
          location: location.name,
          timestamp: new Date().toISOString(),
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
};

module.exports = attendanceController;
