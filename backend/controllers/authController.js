const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

/**
 * AuthController - Menangani autentikasi (login, register, profil).
 */
const authController = {
  /**
   * POST /api/auth/register
   * Registrasi user baru (hanya admin yang bisa).
   */
  register: async (req, res, next) => {
    try {
      const { name, email, nip, password, role } = req.body;

      // Validasi input
      if (!name || !email || !nip || !password) {
        return res.status(400).json({
          success: false,
          message: 'Name, email, NIP, dan password wajib diisi.',
        });
      }

      // Cek email unik
      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email sudah terdaftar.',
        });
      }

      // Cek NIP unik
      const existingNip = await User.findByNip(nip);
      if (existingNip) {
        return res.status(409).json({
          success: false,
          message: 'NIP sudah terdaftar.',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Buat user
      const user = await User.create({
        name,
        email,
        nip,
        password: hashedPassword,
        role: role || 'user',
      });

      return res.status(201).json({
        success: true,
        message: 'User berhasil didaftarkan.',
        data: {
          id: user.id,
          name: user.name,
          email: user.email,
          nip: user.nip,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/auth/login
   * Login menggunakan email/NIP + password.
   */
  login: async (req, res, next) => {
    try {
      const { email, nip, password } = req.body;

      if (!password || (!email && !nip)) {
        return res.status(400).json({
          success: false,
          message: 'Email/NIP dan password wajib diisi.',
        });
      }

      // Cari user berdasarkan email atau NIP
      let user = null;
      if (email) {
        user = await User.findByEmail(email);
      } else if (nip) {
        user = await User.findByNip(nip);
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email/NIP atau password salah.',
        });
      }

      // Verifikasi password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Email/NIP atau password salah.',
        });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      return res.status(200).json({
        success: true,
        message: 'Login berhasil.',
        data: {
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            nip: user.nip,
            role: user.role,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/auth/profile
   * Ambil profil user yang sedang login.
   */
  getProfile: async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan.',
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profil berhasil diambil.',
        data: user,
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
