const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { broadcastToAdmins } = require('../utils/sseManager');
const { getTodayRangeWIB } = require('../utils/dateHelper');
const path = require('path');
const fs = require('fs');

/**
 * Controller untuk mengelola permohonan izin karyawan.
 */
const leaveController = {
  /**
   * POST /api/leaves - Membuat permohonan izin baru (dari mobile)
   * Body: multipart/form-data { reason, description, attachment (file) }
   */
  create: async (req, res) => {
    try {
      const userId = req.user.id;
      const { reason, description } = req.body;

      // 1. Cek apakah user sudah Clock In hari ini (sudah masuk log hadir)
      const todayAttendance = await Attendance.getTodayStatus(userId);
      if (todayAttendance.hasClockedIn) {
        if (req.file) fs.unlinkSync(req.file.path);
        const inTime = todayAttendance.clockIn?.time || 'hari ini';
        return res.status(400).json({
          success: false,
          message: `Anda sudah melakukan Clock In pada pukul ${inTime} dan tercatat hadir, sehingga tidak dapat mengajukan izin.`,
        });
      }

      // 2. Cek apakah user sudah pernah mengajukan izin hari ini (hanya 1x per hari)
      const existingLeave = await LeaveRequest.findTodayByUserId(userId);
      if (existingLeave) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Anda sudah mengajukan izin hari ini. Pengajuan izin hanya dapat dilakukan 1 kali per hari. Anda hanya dapat mengedit izin yang sudah diajukan.',
          data: existingLeave,
        });
      }

      if (!reason || reason.trim() === '') {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Alasan izin wajib diisi.',
        });
      }

      let attachmentPath = null;
      if (req.file) {
        attachmentPath = `uploads/leaves/${req.file.filename}`;
      }

      const leave = await LeaveRequest.create({
        user_id: userId,
        reason: reason.trim(),
        description: description ? description.trim() : null,
        attachment: attachmentPath,
      });

      // Kirim notifikasi ke semua admin/super user via SSE real-time
      try {
        const user = await User.findById(userId);
        const userName = user ? user.name : 'Karyawan';
        const notifData = {
          title: '📋 Permohonan Izin Baru',
          body: `${userName} mengajukan izin: ${reason.trim()}`,
          userName,
          reason: reason.trim(),
          leaveId: leave.id || null,
          timestamp: new Date().toISOString(),
        };

        broadcastToAdmins('leave-request', notifData);
      } catch (notifError) {
        // Jangan gagalkan response jika notifikasi gagal terkirim
        console.error('Notification error (non-fatal):', notifError.message);
      }

      return res.status(201).json({
        success: true,
        message: 'Permohonan izin berhasil dikirim.',
        data: leave,
      });
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      console.error('Error creating leave request:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat permohonan izin.',
      });
    }
  },

  /**
   * GET /api/leaves/today - Ambil status izin hari ini untuk user yang login
   */
  getTodayLeave: async (req, res) => {
    try {
      const userId = req.user.id;
      const leave = await LeaveRequest.findTodayByUserId(userId);
      const todayAttendance = await Attendance.getTodayStatus(userId);

      return res.status(200).json({
        success: true,
        data: {
          leave,
          hasClockedIn: todayAttendance.hasClockedIn,
          hasClockedOut: todayAttendance.hasClockedOut,
          clockInTime: todayAttendance.clockIn?.time || null,
        },
      });
    } catch (error) {
      console.error('Error fetching today leave:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memuat status izin hari ini.',
      });
    }
  },

  /**
   * PUT /api/leaves/:id - Edit permohonan izin yang sudah diajukan hari ini
   * Karyawan dapat mengubah alasan, keterangan, dan lampiran saja.
   */
  update: async (req, res) => {
    try {
      const userId = req.user.id;
      const leaveId = parseInt(req.params.id, 10);
      const { reason, description, remove_attachment } = req.body;

      // 1. Cek apakah user sudah Clock In hari ini
      const todayAttendance = await Attendance.getTodayStatus(userId);
      if (todayAttendance.hasClockedIn) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Anda sudah melakukan Clock In hari ini dan tercatat hadir, sehingga tidak dapat mengedit izin.',
        });
      }

      const leave = await LeaveRequest.findById(leaveId);
      if (!leave) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Permohonan izin tidak ditemukan.',
        });
      }

      // Pastikan izin milik user yang sedang login
      if (leave.user_id !== userId) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki hak untuk mengedit permohonan izin ini.',
        });
      }

      // Pastikan izin ini dibuat pada hari ini (WIB)
      const { todayStr } = getTodayRangeWIB();
      const leaveDate = new Date(leave.created_at);
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
      const leaveDateStr = formatter.format(leaveDate);

      if (leaveDateStr !== todayStr) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Anda hanya dapat mengedit permohonan izin pada hari yang sama.',
        });
      }

      if (!reason || reason.trim() === '') {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Alasan izin wajib diisi.',
        });
      }

      let attachmentPath = leave.attachment;

      if (req.file) {
        // Hapus file lama jika ada
        if (leave.attachment) {
          const oldFilePath = path.join(__dirname, '..', leave.attachment);
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
            } catch (err) {
              console.error('Error deleting old leave attachment:', err.message);
            }
          }
        }
        attachmentPath = `uploads/leaves/${req.file.filename}`;
      } else if (remove_attachment === 'true' || remove_attachment === '1') {
        if (leave.attachment) {
          const oldFilePath = path.join(__dirname, '..', leave.attachment);
          if (fs.existsSync(oldFilePath)) {
            try {
              fs.unlinkSync(oldFilePath);
            } catch (err) {
              console.error('Error deleting old leave attachment:', err.message);
            }
          }
        }
        attachmentPath = null;
      }

      await LeaveRequest.update({
        id: leaveId,
        reason: reason.trim(),
        description: description ? description.trim() : null,
        attachment: attachmentPath,
      });

      const updatedLeave = await LeaveRequest.findById(leaveId);

      // Notifikasi SSE ke admin bahwa izin telah diperbarui
      try {
        const user = await User.findById(userId);
        const userName = user ? user.name : 'Karyawan';
        broadcastToAdmins('leave-request-updated', {
          title: '📝 Permohonan Izin Diperbarui',
          body: `${userName} memperbarui izin: ${reason.trim()}`,
          userName,
          reason: reason.trim(),
          leaveId: leaveId,
          timestamp: new Date().toISOString(),
        });
      } catch (notifErr) {
        console.error('Notification error (non-fatal):', notifErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Permohonan izin berhasil diperbarui.',
        data: updatedLeave,
      });
    } catch (error) {
      if (req.file) fs.unlinkSync(req.file.path);
      console.error('Error updating leave request:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memperbarui permohonan izin.',
      });
    }
  },

  /**
   * GET /api/leaves - Ambil daftar semua permohonan izin (admin)
   * Query: ?page=1&limit=20&status=pending|approved|rejected|all
   */
  getAll: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status || 'all';
      const { date_from, date_to } = req.query;

      const result = await LeaveRequest.findAll({ page, limit, status, date_from, date_to });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      });
    } catch (error) {
      console.error('Error fetching leave requests:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memuat daftar permohonan izin.',
      });
    }
  },

  /**
   * GET /api/leaves/my - Ambil permohonan izin milik user yang sedang login
   */
  getMyLeaves: async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await LeaveRequest.findByUserId(userId, { page, limit });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
          limit,
        },
      });
    } catch (error) {
      console.error('Error fetching my leave requests:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memuat riwayat izin Anda.',
      });
    }
  },

  /**
   * GET /api/leaves/:id - Ambil detail permohonan izin
   */
  getById: async (req, res) => {
    try {
      const leave = await LeaveRequest.findById(req.params.id);

      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Permohonan izin tidak ditemukan.',
        });
      }

      return res.status(200).json({
        success: true,
        data: leave,
      });
    } catch (error) {
      console.error('Error fetching leave detail:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memuat detail izin.',
      });
    }
  },

  /**
   * PATCH /api/leaves/:id/approve - Approve permohonan izin (admin only)
   */
  approve: async (req, res) => {
    try {
      const leaveId = req.params.id;
      const adminId = req.user.id;

      const leave = await LeaveRequest.findById(leaveId);
      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Permohonan izin tidak ditemukan.',
        });
      }

      if (leave.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Permohonan izin sudah ${leave.status === 'approved' ? 'disetujui' : 'ditolak'}.`,
        });
      }

      await LeaveRequest.updateStatus(leaveId, 'approved', adminId);

      // Buat log absensi dengan status 'Izin' setelah disetujui
      await Attendance.createLeaveLog({
        user_id: leave.user_id,
        reason: leave.reason,
      });

      return res.status(200).json({
        success: true,
        message: 'Permohonan izin berhasil disetujui dan log absensi Izin telah dicatat.',
      });
    } catch (error) {
      console.error('Error approving leave:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal menyetujui permohonan izin.',
      });
    }
  },

  /**
   * PATCH /api/leaves/:id/reject - Tolak permohonan izin (admin only)
   */
  reject: async (req, res) => {
    try {
      const leaveId = req.params.id;
      const adminId = req.user.id;

      const leave = await LeaveRequest.findById(leaveId);
      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Permohonan izin tidak ditemukan.',
        });
      }

      if (leave.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: `Permohonan izin sudah ${leave.status === 'approved' ? 'disetujui' : 'ditolak'}.`,
        });
      }

      await LeaveRequest.updateStatus(leaveId, 'rejected', adminId);

      return res.status(200).json({
        success: true,
        message: 'Permohonan izin telah ditolak.',
      });
    } catch (error) {
      console.error('Error rejecting leave:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal menolak permohonan izin.',
      });
    }
  },
};

module.exports = leaveController;
