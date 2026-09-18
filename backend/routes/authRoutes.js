const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');

/**
 * Routes Autentikasi
 *
 * POST  /api/auth/register  - Register user baru (admin only)
 * POST  /api/auth/login     - Login (email/NIP + password)
 * GET   /api/auth/profile   - Profil user yang login
 */

router.post('/register', authMiddleware, adminOnly, authController.register);
router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;
