const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');

const { uploadFace } = require('../config/multer');

/**
 * Routes Autentikasi
 *
 * POST  /api/auth/register  - Register user baru (admin only)
 * POST  /api/auth/login     - Login (email/NIP + password)
 * GET   /api/auth/profile   - Profil user yang login
 * POST  /api/auth/face      - Upload master foto wajah user yang login
 */

router.post('/register', authMiddleware, adminOnly, uploadFace.single('face_photo'), authController.register);
router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.post('/face', authMiddleware, uploadFace.single('face_photo'), authController.uploadMyFacePhoto);

module.exports = router;
