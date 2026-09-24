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

// Lokasi aktif kantor/kampus (untuk user mobile validasi geofencing)
router.get('/active', authMiddleware, locationController.getActiveLocation);

router.get('/', authMiddleware, adminOnly, locationController.getAllLocations);
router.get('/:id', authMiddleware, adminOnly, locationController.getLocationById);
router.post('/', authMiddleware, adminOnly, locationController.createLocation);
router.put('/:id', authMiddleware, adminOnly, locationController.updateLocation);
router.delete('/:id', authMiddleware, adminOnly, locationController.deleteLocation);

module.exports = router;
