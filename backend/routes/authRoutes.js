const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');

/**
 * Routes Autentikasi:
 * POST  /api/auth/login     - Login user/admin
 * GET   /api/auth/profile   - Profil user yang login
 * POST  /api/auth/register  - Register user (admin only)
 */

router.post('/login', authController.login);
router.get('/profile', authMiddleware, authController.getProfile);
router.post('/register', authMiddleware, adminOnly, authController.register);

module.exports = router;
