/**
 * Service API Presensi Admin & Mobile
 * Terhubung langsung ke Backend REST API (MySQL Database)
 */

/**
 * Helper untuk mengambil auth token dari localStorage
 */
function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Cek apakah server backend aktif
 */
export async function checkBackendStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

export function handleUnauthorized() {
  localStorage.removeItem('token');
  localStorage.removeItem('admin_user');
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

/**
 * 1. Ambil Semua Log Absensi (Melihat Log Absen)
 */
export async function fetchAttendanceLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  if (params.user_id) query.append('user_id', params.user_id);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const res = await fetch(`/api/attendance?${query.toString()}`, {
    headers: { ...getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengambil data log absensi.');
  }

  const data = await res.json();
  return { success: true, data: data.data || [], pagination: data.pagination };
}

/**
 * 2. Ambil Detail Log Absensi
 */
export async function fetchAttendanceDetail(id) {
  const res = await fetch(`/api/attendance/${id}`, {
    headers: { ...getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengambil detail absensi.');
  }

  const data = await res.json();
  return { success: true, data: data.data };
}

/**
 * 3. Ambil Daftar Pengguna / Karyawan (Manajemen User)
 */
export async function fetchUsers() {
  const res = await fetch('/api/users', {
    headers: { ...getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengambil daftar pengguna.');
  }

  const data = await res.json();
  return { success: true, data: data.data || [] };
}

/**
 * 4. Tambah Pengguna Baru
 */
export async function createUser(userData) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(userData),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menambahkan pengguna.');
  }

  return { success: true, data: data.data };
}

/**
 * 5. Update Data Pengguna
 */
export async function updateUser(id, userData) {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(userData),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal memperbarui data pengguna.');
  }

  return { success: true, data: data.data };
}

/**
 * 6. Hapus Pengguna
 */
export async function deleteUser(id) {
  const res = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menghapus pengguna.');
  }

  return { success: true };
}
