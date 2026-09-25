/**
 * Utility untuk memformat URL gambar agar dapat ditampilkan dengan benar di Frontend.
 * Mendukung URL eksternal (Unsplash/HTTP/HTTPS), Blob preview, Data URI,
 * serta path relatif upload dari backend Express (seperti "faces/..." atau "/uploads/...").
 */
export function getImageUrl(path) {
  if (!path) return '';

  const strPath = String(path).trim();
  if (!strPath) return '';

  // 1. Jika sudah berupa URL lengkap (HTTP, HTTPS, Blob URL, Data URI)
  if (
    strPath.startsWith('http://') ||
    strPath.startsWith('https://') ||
    strPath.startsWith('blob:') ||
    strPath.startsWith('data:')
  ) {
    return strPath;
  }

  // Normalisasi backslash dari path Windows jika ada
  const cleanPath = strPath.replace(/\\/g, '/');

  // 2. Jika sudah diawali '/uploads/'
  if (cleanPath.startsWith('/uploads/')) {
    return cleanPath;
  }

  // 3. Jika diawali 'uploads/'
  if (cleanPath.startsWith('uploads/')) {
    return `/${cleanPath}`;
  }

  // 4. Jika diawali '/'
  if (cleanPath.startsWith('/')) {
    return `/uploads${cleanPath}`;
  }

  // 5. Jika path relatif biasa seperti "faces/filename.jpg" atau "attendance/filename.jpg"
  return `/uploads/${cleanPath}`;
}
