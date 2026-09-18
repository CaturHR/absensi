const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

/**
 * Konfigurasi Multer untuk upload foto absensi.
 * - Menyimpan ke folder uploads/attendance/
 * - Nama file di-hash (SHA-256 partial) untuk keamanan dan menghindari konflik
 * - Hanya menerima file gambar (jpeg, jpg, png)
 * - Maksimum ukuran file dari environment variable
 */

const UPLOAD_DIR_ATTENDANCE = path.join(__dirname, '..', 'uploads', 'attendance');
const UPLOAD_DIR_FACES = path.join(__dirname, '..', 'uploads', 'faces');

/**
 * Buat storage engine untuk direktori tertentu.
 * @param {string} destDir - Direktori tujuan upload
 * @returns {multer.StorageEngine}
 */
const createStorage = (destDir) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, destDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
    },
  });
};

/**
 * Filter file: hanya menerima gambar.
 */
const imageFileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Hanya file gambar (JPEG, JPG, PNG) yang diizinkan.'), false);
  }
};

const maxSizeMB = parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 5;

/**
 * Multer instance untuk upload foto absensi.
 */
const uploadAttendance = multer({
  storage: createStorage(UPLOAD_DIR_ATTENDANCE),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: maxSizeMB * 1024 * 1024,
  },
});

/**
 * Multer instance untuk upload foto master wajah.
 */
const uploadFace = multer({
  storage: createStorage(UPLOAD_DIR_FACES),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: maxSizeMB * 1024 * 1024,
  },
});

module.exports = {
  uploadAttendance,
  uploadFace,
  UPLOAD_DIR_ATTENDANCE,
  UPLOAD_DIR_FACES,
};
