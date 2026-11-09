const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

/**
 * AuthController - Menangani autentikasi (login, register admin, profil).
 */
const authController = {
  /**
   * POST /api/auth/login
   * Login menggunakan email/NIP + password.
   */
  login: async (req, res, next) => {
    try {
      const { email, nip, identifier, password } = req.body;
      const loginId = (identifier || email || nip || '').trim();

      if (!password || !loginId) {
        return res.status(400).json({
          success: false,
          message: 'Email/Username/NIP dan password wajib diisi.',
        });
      }

      // Cari user berdasarkan email / username
      let user = await User.findByEmail(loginId);
      // Jika tidak ditemukan, coba cari berdasarkan NIP
      if (!user) {
        user = await User.findByNip(loginId);
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Email/Username/NIP atau password salah.',
        });
      }

      // Verifikasi password (mendukung hash bcrypt & fallback plaintext)
      let isPasswordValid = false;
      if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        isPasswordValid = (password === user.password);
        if (isPasswordValid) {
          try {
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(password, salt);
            await User.update(user.id, { password: hashedPassword });
          } catch (hashErr) {
            console.warn('Gagal auto-upgrade password hash:', hashErr.message);
          }
        }
      }

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Email/NIP atau password salah.',
        });
      }

      // Generate JWT token
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
            divisi: user.divisi,
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

  /**
   * POST /api/auth/register
   * Registrasi user baru (admin only).
   */
  register: async (req, res, next) => {
    try {
      const { name, email, nip, password, role, divisi } = req.body;

      if (!name || !email || !nip || !password) {
        return res.status(400).json({
          success: false,
          message: 'Nama, email, NIP, dan password wajib diisi.',
        });
      }

      const existingEmail = await User.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email atau nama pengguna sudah terdaftar.',
        });
      }

      const existingNip = await User.findByNip(nip);
      if (existingNip) {
        return res.status(409).json({
          success: false,
          message: 'NIP sudah terdaftar.',
        });
      }

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.create({
        name: name.trim(),
        email: email.trim(),
        nip: nip.trim(),
        password: hashedPassword,
        role: role || 'user',
        divisi: divisi ? divisi.trim() : null,
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
          divisi: user.divisi,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;
