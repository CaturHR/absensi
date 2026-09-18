const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware untuk verifikasi JWT token.
 * Token dikirim melalui header: Authorization: Bearer <token>
 *
 * Jika valid, req.user akan berisi payload JWT (id, email, role).
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token tidak ditemukan.',
      });
    }

    // Format: "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        success: false,
        message: 'Format token tidak valid. Gunakan: Bearer <token>',
      });
    }

    const token = parts[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user payload ke request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token sudah kedaluwarsa. Silakan login ulang.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token tidak valid.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada autentikasi.',
    });
  }
};

/**
 * Middleware untuk memeriksa role admin.
 * Harus digunakan setelah authMiddleware.
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Akses ditolak. Hanya admin yang diizinkan.',
  });
};

module.exports = { authMiddleware, adminOnly };
