const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');
const { uploadFace } = require('../config/multer');

/**
 * Routes User Management (Admin Only)
 *
 * GET    /api/users          - Ambil semua user
 * GET    /api/users/:id      - Ambil user berdasarkan ID
 * PUT    /api/users/:id      - Update user
 * DELETE /api/users/:id      - Hapus user
 * POST   /api/users/:id/face - Upload foto master wajah
 */

router.get('/', authMiddleware, adminOnly, userController.getAllUsers);
router.get('/:id', authMiddleware, adminOnly, userController.getUserById);
router.put('/:id', authMiddleware, adminOnly, userController.updateUser);
router.delete('/:id', authMiddleware, adminOnly, userController.deleteUser);

// Upload foto master wajah
router.post(
  '/:id/face',
  authMiddleware,
  adminOnly,
  uploadFace.single('face_photo'),
  userController.uploadFacePhoto
);

module.exports = router;
