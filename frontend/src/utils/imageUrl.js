/**
 * Format URL foto agar selalu mengarah ke endpoint static backend yang benar.
 * Mendukung path relatif ('faces/...', 'uploads/...'), full URL, maupun blob URL.
 */
export function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  const clean = path.replace(/^\/+/, '');
  if (clean.startsWith('uploads/')) {
    return `/${clean}`;
  }
  return `/uploads/${clean}`;
}
