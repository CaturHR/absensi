/**
 * Middleware global error handler.
 * Menangkap semua error yang tidak tertangani di route/controller.
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);

  // Multer error handling
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `Ukuran file melebihi batas maksimum (${process.env.UPLOAD_MAX_SIZE_MB || 5}MB).`,
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      message: 'Field upload tidak sesuai. Pastikan nama field benar.',
    });
  }

  if (err.message && err.message.includes('Hanya file gambar')) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Terjadi kesalahan internal server.'
    : err.message || 'Terjadi kesalahan internal server.';

  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = errorHandler;
