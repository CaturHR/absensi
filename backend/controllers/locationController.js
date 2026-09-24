const Location = require('../models/Location');

/**
 * LocationController - CRUD lokasi kantor/kampus (admin only).
 */
const locationController = {
  /**
   * GET /api/locations/active
   * Ambil lokasi aktif saat ini (bisa diakses oleh user/karyawan).
   */
  getActiveLocation: async (req, res, next) => {
    try {
      const location = await Location.getActive();
      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Lokasi kantor aktif belum dikonfigurasi.',
        });
      }
      return res.status(200).json({
        success: true,
        data: location,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/locations
   */
  getAllLocations: async (req, res, next) => {
    try {
      const locations = await Location.findAll();
      return res.status(200).json({
        success: true,
        message: 'Data lokasi berhasil diambil.',
        data: locations,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/locations/:id
   */
  getLocationById: async (req, res, next) => {
    try {
      const location = await Location.findById(parseInt(req.params.id, 10));
      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Lokasi tidak ditemukan.',
        });
      }
      return res.status(200).json({
        success: true,
        data: location,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/locations
   */
  createLocation: async (req, res, next) => {
    try {
      const { name, latitude, longitude, radius, is_active } = req.body;

      if (!name || latitude === undefined || longitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Name, latitude, dan longitude wajib diisi.',
        });
      }

      const defaultRadius = parseInt(process.env.DEFAULT_RADIUS_METERS, 10) || 100;

      const location = await Location.create({
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: radius ? parseInt(radius, 10) : defaultRadius,
        is_active: is_active !== undefined ? is_active : 1,
      });

      return res.status(201).json({
        success: true,
        message: 'Lokasi berhasil ditambahkan.',
        data: location,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/locations/:id
   */
  updateLocation: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, latitude, longitude, radius, is_active } = req.body;

      const existing = await Location.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Lokasi tidak ditemukan.',
        });
      }

      await Location.update(id, {
        name: name || existing.name,
        latitude: latitude !== undefined ? parseFloat(latitude) : existing.latitude,
        longitude: longitude !== undefined ? parseFloat(longitude) : existing.longitude,
        radius: radius !== undefined ? parseInt(radius, 10) : existing.radius,
        is_active: is_active !== undefined ? is_active : existing.is_active,
      });

      const updated = await Location.findById(id);
      return res.status(200).json({
        success: true,
        message: 'Lokasi berhasil diupdate.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/locations/:id
   */
  deleteLocation: async (req, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);
      const location = await Location.findById(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Lokasi tidak ditemukan.',
        });
      }

      await Location.delete(id);
      return res.status(200).json({
        success: true,
        message: 'Lokasi berhasil dihapus.',
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = locationController;
