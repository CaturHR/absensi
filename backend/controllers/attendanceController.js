const Attendance = require('../models/Attendance');
const Location = require('../models/Location');
const geocoder = require('../utils/geocoder');

/**
 * AttendanceController - Menangani proses absensi (Clock In & Clock Out),
 * koordinat GPS, reverse geocoding ke alamat lengkap, riwayat absensi, dan log absensi.
 */
const attendanceController = {
  /**
   * POST /api/attendance
   * Submit absensi: Clock In atau Clock Out dengan GPS lokasi.
   * Body: { type: 'in' | 'out', latitude?: number, longitude?: number }
   */
  submitAttendance: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const type = (req.body.type || 'in').toLowerCase().trim();
      const latitude = req.body.latitude !== undefined && req.body.latitude !== null ? parseFloat(req.body.latitude) : null;
      const longitude = req.body.longitude !== undefined && req.body.longitude !== null ? parseFloat(req.body.longitude) : null;

      if (!['in', 'out'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Tipe presensi tidak valid. Gunakan "in" (Clock In) atau "out" (Clock Out).',
        });
      }

      // Ambil status absensi hari ini
      const todayStatus = await Attendance.getTodayStatus(userId);

      // Jika user sudah memiliki izin yang disetujui hari ini, tidak bisa clock in atau clock out
      if (todayStatus.hasLeaveToday) {
        return res.status(400).json({
          success: false,
          message: 'Anda sudah memiliki izin yang disetujui hari ini, sehingga tidak dapat melakukan absensi.',
        });
      }

      // Helper untuk simpan lokasi & reverse geocoding
      const saveLocationIfPresent = async (attendanceId) => {
        if (latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude)) {
          try {
            // Lakukan reverse geocoding untuk mendapatkan komponen alamat
            const geoData = await geocoder.reverseGeocode(latitude, longitude);
            
            const savedLoc = await Location.create({
              attendance_id: attendanceId,
              latitude,
              longitude,
              alamat: geoData.alamat,
              jalan: geoData.jalan,
              nomor: geoData.nomor,
              rt: geoData.rt,
              rw: geoData.rw,
              kelurahan: geoData.kelurahan,
              kecamatan: geoData.kecamatan,
              kabupaten: geoData.kabupaten,
              provinsi: geoData.provinsi,
            });

            return savedLoc;
          } catch (geoErr) {
            console.warn('⚠️ Gagal menyimpan lokasi absensi:', geoErr.message);
          }
        }
        return null;
      };

      // ──────────────────────────────────────────────
      // Clock In
      // ──────────────────────────────────────────────
      if (type === 'in') {
        if (todayStatus.hasClockedIn) {
          const inTime = todayStatus.clockIn?.time || 'hari ini';
          return res.status(400).json({
            success: false,
            message: `Anda sudah melakukan Clock In hari ini pada pukul ${inTime}.`,
          });
        }

        const log = await Attendance.create({
          user_id: userId,
          status: 'Clock In',
        });

        // Simpan data lokasi GPS jika ada
        const locationData = await saveLocationIfPresent(log.id);

        const now = new Date();
        const timeStr = now
          .toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
          })
          .replace('.', ':');

        return res.status(200).json({
          success: true,
          status: 'Clock In',
          message: `Clock In berhasil pada pukul ${timeStr} WIB.`,
          data: {
            id: log.id,
            status: 'Clock In',
            time: timeStr,
            timestamp: now.toISOString(),
            location: locationData,
          },
        });
      }

      // ──────────────────────────────────────────────
      // Clock Out
      // ──────────────────────────────────────────────
      if (type === 'out') {
        if (!todayStatus.hasClockedIn) {
          return res.status(400).json({
            success: false,
            message: 'Anda belum melakukan Clock In hari ini. Silakan Clock In terlebih dahulu.',
          });
        }

        if (todayStatus.hasClockedOut) {
          const outTime = todayStatus.clockOut?.time || 'hari ini';
          return res.status(400).json({
            success: false,
            message: `Anda sudah melakukan Clock Out hari ini pada pukul ${outTime}.`,
          });
        }

        const log = await Attendance.create({
          user_id: userId,
          status: 'Clock Out',
        });

        // Simpan data lokasi GPS jika ada
        const locationData = await saveLocationIfPresent(log.id);

        const now = new Date();
        const timeStr = now
          .toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Jakarta',
          })
          .replace('.', ':');

        return res.status(200).json({
          success: true,
          status: 'Clock Out',
          message: `Clock Out berhasil pada pukul ${timeStr} WIB.`,
          data: {
            id: log.id,
            status: 'Clock Out',
            time: timeStr,
            timestamp: now.toISOString(),
            location: locationData,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/attendance/today
   * Cek status absensi hari ini (Clock In & Clock Out) user yang sedang login.
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

  /**
   * GET /api/attendance/history
   * Ambil riwayat absensi user yang sedang login (Mobile).
   */
  getMyHistory: async (req, res, next) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 50;

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
   * Ambil semua log absensi (Admin Web: melihat log absen beserta lokasi GPS & alamat lengkap).
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
        message: 'Data log absensi berhasil diambil.',
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
   * Detail absensi berdasarkan ID.
   */
  getAttendanceById: async (req, res, next) => {
    try {
      const attendance = await Attendance.findById(parseInt(req.params.id, 10));

      if (!attendance) {
        return res.status(404).json({
          success: false,
          message: 'Data absensi tidak ditemukan.',
        });
      }

      if (req.user.role !== 'admin' && attendance.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses ke data absensi ini.',
        });
      }

      return res.status(200).json({
        success: true,
        data: attendance,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = attendanceController;
