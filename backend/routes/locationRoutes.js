const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { authMiddleware, adminOnly } = require('../middlewares/authMiddleware');

/**
 * Routes Lokasi Kantor/Kampus (Admin Only)
 *
 * GET    /api/locations      - Ambil semua lokasi
 * GET    /api/locations/:id  - Ambil lokasi berdasarkan ID
 * POST   /api/locations      - Tambah lokasi baru
 * PUT    /api/locations/:id  - Update lokasi
 * DELETE /api/locations/:id  - Hapus lokasi
 */

router.get('/', authMiddleware, adminOnly, locationController.getAllLocations);
router.get('/:id', authMiddleware, adminOnly, locationController.getLocationById);
router.post('/', authMiddleware, adminOnly, locationController.createLocation);
router.put('/:id', authMiddleware, adminOnly, locationController.updateLocation);
router.delete('/:id', authMiddleware, adminOnly, locationController.deleteLocation);

module.exports = router;
