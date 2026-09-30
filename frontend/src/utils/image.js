/**
 * Utility untuk memformat URL gambar agar dapat ditampilkan dengan benar di Frontend.
 * Backend kini menyimpan path secara konsisten dengan prefix 'uploads/...':
 *   - Foto wajah  : 'uploads/faces/filename.jpg'
 *   - Lampiran    : 'uploads/leaves/filename.jpg'
 *   - Foto absensi: 'attendance/filename.jpg' (static route sendiri)
 *
 * Mendukung URL eksternal (HTTP/HTTPS), Blob URL, Data URI, dan path relatif.
 */
export function getImageUrl(path) {
  if (!path) return '';

  const strPath = String(path).trim();
  if (!strPath) return '';

  // 1. Sudah URL lengkap / Blob / Data URI → langsung kembalikan
  if (
    strPath.startsWith('http://') ||
    strPath.startsWith('https://') ||
    strPath.startsWith('blob:') ||
    strPath.startsWith('data:')
  ) {
    return strPath;
  }

  // Normalisasi backslash dari path Windows
  const cleanPath = strPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // 2. Sudah ada prefix 'uploads/' → tambah leading slash saja
  if (cleanPath.startsWith('uploads/')) {
    return `/${cleanPath}`;
  }

  // 3. Backward compat: path lama tanpa prefix 'uploads/' (misal 'faces/...')
  return `/uploads/${cleanPath}`;
}

