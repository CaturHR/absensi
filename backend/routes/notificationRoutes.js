const express = require('express');
const jwt = require('jsonwebtoken');
const { adminOnly } = require('../middlewares/authMiddleware');
const { addConnection, removeConnection } = require('../utils/sseManager');
require('dotenv').config();

const router = express.Router();

// ──────────────────────────────────────────────
// SSE - Server-Sent Events untuk notifikasi real-time
// ──────────────────────────────────────────────

/**
 * Middleware auth khusus untuk SSE.
 * EventSource browser tidak mendukung custom headers,
 * jadi token dikirim via query parameter: ?token=xxx
 */
const sseAuthMiddleware = (req, res, next) => {
  try {
    // Coba ambil token dari query parameter (SSE)
    const token = req.query.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token tidak ditemukan.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

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
        message: 'Token sudah kedaluwarsa.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Token tidak valid.',
    });
  }
};

/**
 * GET /api/notifications/stream?token=xxx
 * SSE endpoint - Admin membuka koneksi persistent untuk menerima notifikasi real-time.
 * Token dikirim via query parameter karena EventSource tidak mendukung custom headers.
 */
router.get('/stream', sseAuthMiddleware, adminOnly, (req, res) => {
  const userId = req.user.id;

  // Set headers untuk SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable buffering di Nginx
  });

  // Kirim event awal agar koneksi langsung aktif
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Terhubung ke notifikasi real-time.', userId })}\n\n`);

  // Simpan koneksi
  addConnection(userId, res);

  // Heartbeat setiap 30 detik agar koneksi tidak timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 30000);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearInterval(heartbeat);
    removeConnection(userId, res);
  };

  // Bersihkan saat koneksi ditutup dari client atau server
  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);
});

module.exports = router;
