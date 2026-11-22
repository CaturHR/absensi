const LeaveRequest = require('../models/LeaveRequest');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const { pool } = require('../config/database');
const { getTodayRangeWIB } = require('../utils/dateHelper');
const path = require('path');
const fs = require('fs');

/**
 * Controller untuk mengelola permohonan izin karyawan.
 * Alur approval izin:
 * 1. Karyawan mengajukan izin via mobile -> status: 'pending'.
 * 2. Belum masuk ke attendance_logs sebelum disetujui.
 * 3. Web admin dapat menyetujui (approve) atau menolak (reject) izin dengan lampiran yang bisa dilihat.
 * 4. Jika disetujui (approve) -> status menjadi 'approved' dan tercatat ke attendance_logs.
 * 5. Jika ditolak (reject) -> status menjadi 'rejected' dengan catatan alasan penolakan (reject_reason).
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

      // 1. Cek apakah user sudah Clock In hari ini
      const todayAttendance = await Attendance.getTodayStatus(userId);
      if (todayAttendance.hasClockedIn) {
        if (req.file) fs.unlinkSync(req.file.path);
        const inTime = todayAttendance.clockIn?.time || 'hari ini';
        return res.status(400).json({
          success: false,
          message: `Anda sudah melakukan Clock In pada pukul ${inTime} dan tercatat hadir, sehingga tidak dapat mengajukan izin.`,
        });
      }

      // 2. Cek apakah user sudah pernah mengajukan izin hari ini
      const existingLeave = await LeaveRequest.findTodayByUserId(userId);
      if (existingLeave) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Anda sudah mengajukan izin hari ini. Pengajuan izin hanya dapat dilakukan 1 kali per hari. Anda dapat mengedit izin yang sudah diajukan.',
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

      // Simpan izin dengan status 'pending' (menunggu persetujuan admin)
      const leave = await LeaveRequest.create({
        user_id: userId,
        reason: reason.trim(),
        description: description ? description.trim() : null,
        attachment: attachmentPath,
        status: 'pending',
      });

      return res.status(201).json({
        success: true,
        message: 'Permohonan izin berhasil diajukan dan sedang menunggu persetujuan admin.',
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
      const todayLeave = await LeaveRequest.findTodayByUserId(userId);
      const todayAttendance = await Attendance.getTodayStatus(userId);

      return res.status(200).json({
        success: true,
        data: {
          leave: todayLeave,
          hasClockedIn: todayAttendance.hasClockedIn,
          clockInTime: todayAttendance.clockIn?.time || null,
        },
      });
    } catch (error) {
      console.error('Error getting today leave:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal memuat status izin hari ini.',
      });
    }
  },

  /**
   * PUT /api/leaves/:id - Edit permohonan izin hari ini (dari mobile)
   */
  update: async (req, res) => {
    try {
      const userId = req.user.id;
      const leaveId = parseInt(req.params.id, 10);
      const { reason, description, remove_attachment } = req.body;

      const existingLeave = await LeaveRequest.findById(leaveId);
      if (!existingLeave) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Data permohonan izin tidak ditemukan.',
        });
      }

      if (existingLeave.user_id !== userId && req.user.role !== 'admin') {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki hak untuk mengedit permohonan izin ini.',
        });
      }

      let attachmentPath = existingLeave.attachment;

      if (req.file) {
        if (existingLeave.attachment) {
          const oldFile = path.join(__dirname, '..', existingLeave.attachment);
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }
        attachmentPath = `uploads/leaves/${req.file.filename}`;
      } else if (remove_attachment === 'true' || remove_attachment === true) {
        if (existingLeave.attachment) {
          const oldFile = path.join(__dirname, '..', existingLeave.attachment);
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
        }
        attachmentPath = null;
      }

      await LeaveRequest.update({
        id: leaveId,
        reason: (reason || existingLeave.reason).trim(),
        description: description !== undefined ? description?.trim() : existingLeave.description,
        attachment: attachmentPath,
      });

      // Jika izin yang diedit sebelumnya ditolak, reset statusnya ke pending agar bisa direview ulang
      if (existingLeave.status === 'rejected') {
        await pool.execute(
          `UPDATE leave_requests SET status = 'pending', reject_reason = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?`,
          [leaveId]
        );
      }

      // Jika sudah approved, perbarui juga di attendance_logs
      if (existingLeave.status === 'approved') {
        try {
          const { startOfDay, endOfDay } = getTodayRangeWIB();
          const updatedReason = (reason || existingLeave.reason).trim();
          const updatedDesc = description !== undefined ? description?.trim() : existingLeave.description;
          const noteText = updatedDesc ? `Izin: ${updatedReason} - ${updatedDesc}` : `Izin: ${updatedReason}`;

          await pool.execute(
            `UPDATE attendance_logs 
             SET notes = ?, status = 'Izin', attachment = ? 
             WHERE user_id = ? AND (status = 'Izin' OR notes LIKE 'Izin:%') AND created_at >= ? AND created_at <= ?`,
            [noteText, attachmentPath || null, existingLeave.user_id, startOfDay, endOfDay]
          );
        } catch (logErr) {
          console.warn('Gagal memperbarui catatan izin di attendance_logs:', logErr.message);
        }
      }

      const updated = await LeaveRequest.findById(leaveId);

      return res.status(200).json({
        success: true,
        message: 'Permohonan izin berhasil diperbarui.',
        data: updated,
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
   * GET /api/leaves/my - Riwayat izin user yang sedang login
   */
  getMyLeaves: async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;

      const result = await LeaveRequest.findByUserId(userId, { page, limit });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      console.error('Error getting my leaves:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil riwayat izin.',
      });
    }
  },

  /**
   * GET /api/leaves - Ambil semua permohonan izin (admin)
   */
  getAll: async (req, res) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const { status, date_from, date_to } = req.query;

      const result = await LeaveRequest.findAll({ page, limit, status, date_from, date_to });

      return res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      });
    } catch (error) {
      console.error('Error getting all leaves:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data permohonan izin.',
      });
    }
  },

  /**
   * GET /api/leaves/:id - Detail izin
   */
  getById: async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const leave = await LeaveRequest.findById(id);

      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Permohonan izin tidak ditemukan.',
        });
      }

      if (req.user.role !== 'admin' && leave.user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses ke permohonan izin ini.',
        });
      }

      return res.status(200).json({
        success: true,
        data: leave,
      });
    } catch (error) {
      console.error('Error getting leave by id:', error);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil detail permohonan izin.',
      });
    }
  },

  /**
   * PATCH /api/leaves/:id/approve - Setujui izin (admin)
   * Mengubah status menjadi 'approved' dan mencatatnya ke attendance_logs sebagai 'Izin'
   */
  approve: async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const adminId = req.user.id;

      const leave = await LeaveRequest.findById(id);
      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Permohonan izin tidak ditemukan.',
        });
      }

      // Update status menjadi 'approved'
      await LeaveRequest.updateStatus(id, 'approved', adminId, null);

      // Catat log presensi di attendance_logs dengan status 'Izin'
      try {
        const [existingLog] = await pool.execute(
          `SELECT id FROM attendance_logs 
           WHERE user_id = ? AND status = 'Izin' AND DATE(created_at) = DATE(?)`,
          [leave.user_id, leave.created_at]
        );

        const noteText = leave.description && leave.description.trim()
          ? `Izin: ${leave.reason} - ${leave.description}`
          : `Izin: ${leave.reason}`;

        if (existingLog.length === 0) {
          await Attendance.createLeaveLog({
            user_id: leave.user_id,
            notes: noteText,
            attachment: leave.attachment,
            created_at: leave.created_at,
          });
        } else {
          await pool.execute(
            `UPDATE attendance_logs SET notes = ?, attachment = ? WHERE id = ?`,
            [noteText, leave.attachment, existingLog[0].id]
          );
        }
      } catch (logErr) {
        console.warn('Gagal mencatat log izin ke attendance_logs:', logErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Permohonan izin berhasil disetujui.',
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
   * PATCH /api/leaves/:id/reject - Tolak izin (admin)
   * Menerima reject_reason dari req.body
   */
  reject: async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const adminId = req.user.id;
      const { reject_reason } = req.body;

      const leave = await LeaveRequest.findById(id);
      if (!leave) {
        return res.status(404).json({
          success: false,
          message: 'Permohonan izin tidak ditemukan.',
        });
      }

      // Update status menjadi 'rejected' dengan reject_reason
      await LeaveRequest.updateStatus(id, 'rejected', adminId, reject_reason || null);

      // Jika sebelumnya pernah tercatat di attendance_logs, hapus catatan izin tersebut
      try {
        await pool.execute(
          `DELETE FROM attendance_logs 
           WHERE user_id = ? AND status = 'Izin' AND DATE(created_at) = DATE(?)`,
          [leave.user_id, leave.created_at]
        );
      } catch (logErr) {
        console.warn('Gagal menghapus log izin dari attendance_logs saat ditolak:', logErr.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Permohonan izin berhasil ditolak.',
        reject_reason: reject_reason || null,
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
