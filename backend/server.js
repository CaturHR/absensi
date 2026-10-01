const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { testConnection } = require('./config/database');
const errorHandler = require('./middlewares/errorHandler');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const locationRoutes = require('./routes/locationRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Import Models (for auto table creation)
const LeaveRequest = require('./models/LeaveRequest');

// ──────────────────────────────────────────────
// Inisialisasi Express App
// ──────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ──────────────────────────────────────────────
// Buat direktori uploads jika belum ada
// ──────────────────────────────────────────────
const uploadDirs = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads', 'attendance'),
  path.join(__dirname, 'uploads', 'faces'),
  path.join(__dirname, 'uploads', 'leaves'),
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Direktori dibuat: ${dir}`);
  }
});

// ──────────────────────────────────────────────
// Security Middlewares
// ──────────────────────────────────────────────

// Helmet - HTTP security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Untuk akses file uploads dari frontend
}));

// CORS - Konfigurasi cross-origin
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CORS_ORIGIN || 'http://localhost:3000'
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate Limiting - Batasi jumlah request per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX, 10) : 1000, // 1000 request per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS' || req.path === '/health', // Lewati preflight dan healthcheck
  message: {
    success: false,
    message: 'Terlalu banyak permintaan dari IP ini. Silakan coba lagi setelah beberapa menit.',
  },
});
app.use('/api/', limiter);

// Rate limiter khusus untuk login (proteksi brute force)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 15, // 15 percobaan login per 15 menit
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan login yang gagal. Silakan coba lagi setelah 15 menit.',
  },
});
app.use('/api/auth/login', loginLimiter);

// ──────────────────────────────────────────────
// Body Parsing & Logging
// ──────────────────────────────────────────────

// Parse JSON body
app.use(express.json({ limit: '10mb' }));

// Parse URL-encoded body
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logging (dev mode)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ──────────────────────────────────────────────
// Static Files - Serve uploaded files
// ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/faces', express.static(path.join(__dirname, 'uploads', 'faces')));
app.use('/attendance', express.static(path.join(__dirname, 'uploads', 'attendance')));
app.use('/leaves', express.static(path.join(__dirname, 'uploads', 'leaves')));

// ──────────────────────────────────────────────
// API Routes
// ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);

// ──────────────────────────────────────────────
// Health Check
// ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server berjalan dengan baik.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ──────────────────────────────────────────────
// 404 Handler
// ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} tidak ditemukan.`,
  });
});

// ──────────────────────────────────────────────
// Global Error Handler
// ──────────────────────────────────────────────
app.use(errorHandler);

// ──────────────────────────────────────────────
// Start Server
// ──────────────────────────────────────────────
const startServer = async () => {
  try {
    // Test koneksi database
    await testConnection();

    // Auto-create leave_requests table if not exists
    try {
      await LeaveRequest.createTable();
      console.log('✅ Tabel leave_requests siap.');
    } catch (err) {
      console.error('⚠️ Gagal membuat tabel leave_requests:', err.message);
    }

    // Jalankan Auto Clock Out untuk presensi hari-hari sebelumnya yang belum di-clock out
    const Attendance = require('./models/Attendance');
    try {
      const autoCount = await Attendance.autoClockOut();
      if (autoCount > 0) {
        console.log(`⏰ Auto Clock Out: ${autoCount} presensi sebelumnya berhasil ditutup otomatis.`);
      }
    } catch (err) {
      console.error('⚠️ Gagal menjalankan auto clock out saat start:', err.message);
    }

    // Interval pemeriksaan Auto Clock Out berkala (setiap 30 menit)
    setInterval(async () => {
      try {
        const autoCount = await Attendance.autoClockOut();
        if (autoCount > 0) {
          console.log(`⏰ Auto Clock Out [Interval]: ${autoCount} presensi berhasil ditutup otomatis.`);
        }
      } catch (err) {
        console.error('⚠️ Error pada background auto clock out:', err.message);
      }
    }, 30 * 60 * 1000);

    app.listen(PORT, () => {
      console.log('══════════════════════════════════════════');
      console.log(`🚀 Server berjalan di port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📡 API URL: http://localhost:${PORT}/api`);
      console.log(`💾 Health Check: http://localhost:${PORT}/api/health`);
      console.log('══════════════════════════════════════════');
    });
  } catch (error) {
    console.error('❌ Gagal memulai server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
