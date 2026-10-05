const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { UPLOAD_DIR_FACES } = require('../config/multer');

/**
 * UserController - CRUD user dan upload foto master wajah (admin only).
 */
const userController = {
  /**
   * POST /api/users
   * Tambah user baru (dengan upload foto master wajah) - Admin only.
   */
  createUser: async (req, res, next) => {
    try {
      const { name, email, nip, password, role, divisi, department } = req.body;
      const targetDivisi = divisi || department;

      if (!name || !email || !nip || !password) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'Nama, email, NIP, dan password wajib diisi.',
        });
      }

      // Cek apakah email sudah terdaftar
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'Email atau nama pengguna sudah digunakan.',
        });
      }

      // Cek apakah NIP sudah terdaftar
      const existingNip = await User.findByNip(nip);
      if (existingNip) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: 'NIP pegawai sudah terdaftar.',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Path foto master wajah
      const facePhoto = req.file ? `uploads/faces/${req.file.filename}` : null;

      const newUser = await User.create({
        name: name.trim(),
        email: email.trim(),
        nip: nip.trim(),
        password: hashedPassword,
        role: role || 'user',
        divisi: targetDivisi ? targetDivisi.trim() : null,
        face_photo: facePhoto,
      });

      return res.status(201).json({
        success: true,
        message: 'User baru berhasil ditambahkan.',
        data: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          nip: newUser.nip,
          role: newUser.role,
          divisi: newUser.divisi,
          department: newUser.divisi,
          face_photo: newUser.face_photo,
        },
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  },

  /**
   * GET /api/users
   * Ambil semua user.
   */
  getAllUsers: async (req, res, next) => {
    try {
      const users = await User.findAll();
      return res.status(200).json({
        success: true,
        message: 'Data user berhasil diambil.',
        data: users,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/users/:id
   * Ambil user berdasarkan ID.
   */
  getUserById: async (req, res, next) => {
    try {
      const user = await User.findById(parseInt(req.params.id, 10));
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan.',
        });
      }
      return res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/users/:id
   * Update data user.
   */
  updateUser: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, email, nip, password, role, divisi, department } = req.body;
      const targetDivisi = divisi !== undefined ? divisi : department;

      const existingUser = await User.findById(id);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan.',
        });
      }

      const updateData = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (nip) updateData.nip = nip;
      if (role) updateData.role = role;
      if (targetDivisi !== undefined) updateData.divisi = targetDivisi;

      if (password) {
        const salt = await bcrypt.genSalt(12);
        updateData.password = await bcrypt.hash(password, salt);
      }

      await User.update(id, updateData);

      const updatedUser = await User.findById(id);
      return res.status(200).json({
        success: true,
        message: 'User berhasil diupdate.',
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/users/:id
   * Hapus user.
   */
  deleteUser: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan.',
        });
      }

      // Hapus foto master jika ada
      if (user.face_photo) {
        const facePhotoPath = path.join(UPLOAD_DIR_FACES, path.basename(user.face_photo));
        if (fs.existsSync(facePhotoPath)) {
          fs.unlinkSync(facePhotoPath);
        }
      }

      await User.delete(id);
      return res.status(200).json({
        success: true,
        message: 'User berhasil dihapus.',
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/users/:id/face
   * Upload foto master wajah user.
   */
  uploadFacePhoto: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Foto wajah wajib diunggah.',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan.',
        });
      }

      // Hapus foto lama jika ada
      if (user.face_photo) {
        const oldPhotoPath = path.join(UPLOAD_DIR_FACES, path.basename(user.face_photo));
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }

      const facePhotoRelative = `uploads/faces/${req.file.filename}`;
      await User.update(id, { face_photo: facePhotoRelative });

      return res.status(200).json({
        success: true,
        message: 'Foto master wajah berhasil diunggah.',
        data: {
          face_photo: facePhotoRelative,
        },
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(error);
    }
  },
};

module.exports = userController;
