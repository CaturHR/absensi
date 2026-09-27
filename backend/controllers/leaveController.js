const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
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

      if (!reason || reason.trim() === '') {
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

      return res.status(201).json({
        success: true,
        message: 'Permohonan izin berhasil dikirim.',
        data: leave,
      });
    } catch (error) {
      console.error('Error creating leave request:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal membuat permohonan izin.',
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

      const result = await LeaveRequest.findAll({ page, limit, status });

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
