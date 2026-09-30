/**
 * Service API Presensi Admin
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
 * 1. Ambil Semua Log Absensi (dengan filter & pagination)
 */
export async function fetchAttendanceLogs(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  if (params.location_id && params.location_id !== 'all') query.append('location_id', params.location_id);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const res = await fetch(`/api/attendance?${query.toString()}`, {
    headers: { ...getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengambil data absensi.');
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
 * 2b. Update Status Verifikasi Absensi / Kecocokan Wajah (Admin)
 */
export async function updateAttendanceStatus(id, status, notes) {
  const res = await fetch(`/api/attendance/${id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ status, notes }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal memperbarui status absensi.');
  }

  const data = await res.json();
  return { success: true, message: data.message };
}

/**
 * 3. Ambil Daftar Pengguna / Karyawan
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
 * 4. Tambah Pengguna Baru (dengan upload foto wajah master)
 */
export async function createUser(formData) {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
    },
    body: formData, // FormData object
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menambahkan pengguna.');
  }

  return { success: true, data: data.data };
}

/**
 * 4b. Update Data Pengguna
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
 * 4c. Upload/Update Foto Master Wajah Pengguna
 */
export async function updateUserFace(id, formData) {
  const res = await fetch(`/api/users/${id}/face`, {
    method: 'POST',
    headers: {
      ...getAuthHeader(),
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal mengunggah foto master wajah.');
  }

  return { success: true, data: data.data };
}

/**
 * 5. Hapus Pengguna
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

/**
 * 6. Ambil Pengaturan Lokasi Kantor Aktif
 */
export async function fetchOfficeLocation() {
  const res = await fetch('/api/locations', {
    headers: { ...getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengambil lokasi kantor.');
  }

  const data = await res.json();
  const locList = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
  const activeLoc = locList.find((l) => l.is_active) || locList[0] || null;
  return { success: true, data: activeLoc };
}

/**
 * 6b. Ambil Semua Daftar Titik Lokasi Kantor
 */
export async function fetchLocations() {
  const res = await fetch('/api/locations', {
    headers: { ...getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengambil daftar lokasi kantor.');
  }

  const data = await res.json();
  const locList = Array.isArray(data.data) ? data.data : (data.data ? [data.data] : []);
  return { success: true, data: locList };
}

/**
 * 7. Update Titik Lokasi Kantor
 */
export async function updateOfficeLocation(locationData) {
  const id = locationData.id || 1;
  const res = await fetch(`/api/locations/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(locationData),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal memperbarui lokasi kantor.');
  }

  return { success: true, data: data.data };
}

/**
 * 7b. Tambah Titik Lokasi Kantor Baru
 */
export async function createLocation(locationData) {
  const res = await fetch('/api/locations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(locationData),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menambahkan lokasi kantor.');
  }

  return { success: true, data: data.data };
}

/**
 * 7c. Hapus Titik Lokasi Kantor
 */
export async function deleteLocation(id) {
  const res = await fetch(`/api/locations/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menghapus lokasi kantor.');
  }

  return { success: true };
}

/**
 * 8. Ambil Semua Permohonan Izin (Admin)
 */
export async function fetchLeaveRequests(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.date_from) query.append('date_from', params.date_from);
  if (params.date_to) query.append('date_to', params.date_to);
  if (params.page) query.append('page', params.page);
  if (params.limit) query.append('limit', params.limit);

  const res = await fetch(`/api/leaves?${query.toString()}`, {
    headers: { ...getAuthHeader() },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Gagal mengambil data permohonan izin.');
  }

  const data = await res.json();
  return { success: true, data: data.data || [] };
}

/**
 * 9. Approve Permohonan Izin
 */
export async function approveLeave(id) {
  const res = await fetch(`/api/leaves/${id}/approve`, {
    method: 'PATCH',
    headers: { ...getAuthHeader() },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menyetujui izin.');
  }

  return { success: true, message: data.message };
}

/**
 * 10. Tolak Permohonan Izin
 */
export async function rejectLeave(id) {
  const res = await fetch(`/api/leaves/${id}/reject`, {
    method: 'PATCH',
    headers: { ...getAuthHeader() },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menolak izin.');
  }

  return { success: true, message: data.message };
}
