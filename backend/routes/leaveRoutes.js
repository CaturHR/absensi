const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');
const leaveController = require('../controllers/leaveController');

const router = express.Router();

// Pastikan direktori uploads/leaves tersedia
const leaveUploadDir = path.join(__dirname, '..', 'uploads', 'leaves');
if (!fs.existsSync(leaveUploadDir)) {
  fs.mkdirSync(leaveUploadDir, { recursive: true });
}

// Konfigurasi Multer untuk upload file lampiran izin
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, leaveUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `leave_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('Hanya file gambar (jpg, png, gif), PDF, dan dokumen Word yang diizinkan.'));
  },
});

// ──────────────────────────────────────────────
// Routes Permohonan Izin
// ──────────────────────────────────────────────

// POST /api/leaves - Buat permohonan izin (karyawan, dengan file lampiran)
router.post('/', authMiddleware, upload.single('attachment'), leaveController.create);

// GET /api/leaves/my - Ambil izin milik user yang sedang login
router.get('/my', authMiddleware, leaveController.getMyLeaves);

// GET /api/leaves - Ambil semua permohonan izin (admin only)
router.get('/', authMiddleware, adminOnly, leaveController.getAll);

// GET /api/leaves/:id - Detail permohonan izin
router.get('/:id', authMiddleware, leaveController.getById);

// PATCH /api/leaves/:id/approve - Approve izin (admin only)
router.patch('/:id/approve', authMiddleware, adminOnly, leaveController.approve);

// PATCH /api/leaves/:id/reject - Tolak izin (admin only)
router.patch('/:id/reject', authMiddleware, adminOnly, leaveController.reject);

module.exports = router;
