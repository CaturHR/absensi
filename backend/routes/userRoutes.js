const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');

/**
 * Routes Manajemen User (Admin Only):
 * GET    /api/users      - Ambil semua user
 * POST   /api/users      - Tambah user baru
 * GET    /api/users/:id  - Ambil user berdasarkan ID
 * PUT    /api/users/:id  - Update user
 * DELETE /api/users/:id  - Hapus user
 */

router.get('/', authMiddleware, adminOnly, userController.getAllUsers);
router.post('/', authMiddleware, adminOnly, userController.createUser);
router.get('/:id', authMiddleware, adminOnly, userController.getUserById);
router.put('/:id', authMiddleware, adminOnly, userController.updateUser);
router.delete('/:id', authMiddleware, adminOnly, userController.deleteUser);

module.exports = router;
