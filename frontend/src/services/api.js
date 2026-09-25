/**
 * Service API Presensi Admin
 * Mendukung koneksi ke backend Express.js dengan fallback otomatis ke Mock Data
 * jika server backend offline atau dalam mode pratinjau standalone.
 */
import { MOCK_ATTENDANCE_LOGS, MOCK_USERS, MOCK_OFFICE_LOCATION } from '../data/mockData';

// Simpan state in-memory saat menggunakan mock data (agar aksi tambah user / update lokasi berefek di UI)
let localLogs = [...MOCK_ATTENDANCE_LOGS];
let localUsers = [...MOCK_USERS];
let localOffice = { ...MOCK_OFFICE_LOCATION };

const BASE_URL = '';

/**
 * Cek apakah server backend aktif
 */
export async function checkBackendStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Helper untuk mengambil auth token dari localStorage jika ada
 */
function getAuthHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * 1. Ambil Semua Log Absensi (dengan filter & pagination)
 */
export async function fetchAttendanceLogs(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const res = await fetch(`/api/attendance?${query.toString()}`, {
      headers: { credentials: 'include', ...getAuthHeader() },
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data || [], isMock: false };
    }
  } catch (err) {
    console.info('Backend unreachable, using Mock Attendance Logs:', err.message);
  }

  // Fallback to Mock Data
  let filtered = [...localLogs];
  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((log) => log.status === params.status);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (log) =>
        log.user_name.toLowerCase().includes(q) ||
        log.user_nip.toLowerCase().includes(q) ||
        (log.department && log.department.toLowerCase().includes(q))
    );
  }

  return {
    success: true,
    data: filtered,
    pagination: {
      total: filtered.length,
      page: 1,
      totalPages: 1,
      limit: filtered.length,
    },
    isMock: true,
  };
}

/**
 * 2. Ambil Detail Log Absensi
 */
export async function fetchAttendanceDetail(id) {
  try {
    const res = await fetch(`/api/attendance/${id}`, {
      headers: { ...getAuthHeader() },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data, isMock: false };
    }
  } catch (err) {
    console.info('Backend unreachable, using Mock Detail:', err.message);
  }

  const log = localLogs.find((item) => item.id === Number(id));
  return { success: true, data: log || null, isMock: true };
}

/**
 * 3. Ambil Daftar Pengguna
 */
export async function fetchUsers() {
  try {
    const res = await fetch('/api/users', {
      headers: { ...getAuthHeader() },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data || [], isMock: false };
    }
  } catch (err) {
    console.info('Backend unreachable, using Mock Users:', err.message);
  }

  return { success: true, data: localUsers, isMock: true };
}

/**
 * 4. Tambah Pengguna Baru (dengan File Upload Master Wajah)
 */
export async function createUser(formData) {
  try {
    // Jika terhubung ke backend express:
    // Backend memiliki endpoint POST /api/auth/register dan POST /api/users/:id/face
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data, isMock: false };
    }
  } catch (err) {
    console.info('Backend unreachable, simulating User Creation in Mock mode:', err.message);
  }

  // Simulasi di mode Mock
  const name = formData.get('name') || 'Pegawai Baru';
  const email = formData.get('email') || 'pegawai@perusahaan.co.id';
  const nip = formData.get('nip') || `PEG-${Date.now().toString().slice(-4)}`;
  const role = formData.get('role') || 'user';
  const department = formData.get('department') || 'General';
  const photoFile = formData.get('face_photo');

  let facePhotoUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&auto=format&fit=crop&q=80';
  if (photoFile && photoFile instanceof File && photoFile.size > 0) {
    facePhotoUrl = URL.createObjectURL(photoFile);
  }

  const newUser = {
    id: Date.now(),
    name,
    email,
    nip,
    role,
    department,
    face_photo: facePhotoUrl,
    created_at: new Date().toISOString(),
  };

  localUsers = [newUser, ...localUsers];
  return { success: true, data: newUser, isMock: true };
}

/**
 * 5. Hapus Pengguna
 */
export async function deleteUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() },
    });
    if (res.ok) return { success: true, isMock: false };
  } catch (err) {
    console.info('Backend unreachable, deleting from Mock list:', err.message);
  }

  localUsers = localUsers.filter((u) => u.id !== Number(id));
  return { success: true, isMock: true };
}

/**
 * 6. Ambil Pengaturan Lokasi Kantor
 */
export async function fetchOfficeLocation() {
  try {
    const res = await fetch('/api/locations', {
      headers: { ...getAuthHeader() },
    });
    if (res.ok) {
      const data = await res.json();
      // Ambil lokasi aktif
      const activeLoc = Array.isArray(data.data) ? data.data.find((l) => l.is_active) || data.data[0] : data.data;
      if (activeLoc) return { success: true, data: activeLoc, isMock: false };
    }
  } catch (err) {
    console.info('Backend unreachable, using Mock Location:', err.message);
  }

  return { success: true, data: localOffice, isMock: true };
}

/**
 * 7. Update Pengaturan Lokasi Kantor
 */
export async function updateOfficeLocation(locationData) {
  try {
    const id = locationData.id || 1;
    const res = await fetch(`/api/locations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(locationData),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data, isMock: false };
    }
  } catch (err) {
    console.info('Backend unreachable, updating Mock Location:', err.message);
  }

  localOffice = {
    ...localOffice,
    ...locationData,
    updated_at: new Date().toISOString(),
  };

  return { success: true, data: localOffice, isMock: true };
}

// ──────────────────────────────────────────────
// Leave Request API (Permohonan Izin)
// ──────────────────────────────────────────────

// Mock leave data for offline mode
let localLeaves = [];

/**
 * 8. Ambil Semua Permohonan Izin (Admin)
 */
export async function fetchLeaveRequests(params = {}) {
  try {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'all') query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const res = await fetch(`/api/leaves?${query.toString()}`, {
      headers: { ...getAuthHeader() },
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, data: data.data || [], isMock: false };
    }
  } catch (err) {
    console.info('Backend unreachable, using Mock Leave Data:', err.message);
  }

  // Fallback to mock
  let filtered = [...localLeaves];
  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((l) => l.status === params.status);
  }
  return { success: true, data: filtered, isMock: true };
}

/**
 * 9. Approve Permohonan Izin
 */
export async function approveLeave(id) {
  try {
    const res = await fetch(`/api/leaves/${id}/approve`, {
      method: 'PATCH',
      headers: { ...getAuthHeader() },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message, isMock: false };
    }
    const errData = await res.json();
    return { success: false, message: errData.message || 'Gagal menyetujui izin.' };
  } catch (err) {
    console.info('Backend unreachable, approving in mock mode:', err.message);
  }

  // Mock fallback
  localLeaves = localLeaves.map((l) =>
    l.id === Number(id) ? { ...l, status: 'approved', reviewed_at: new Date().toISOString() } : l
  );
  return { success: true, message: 'Izin disetujui (mock).', isMock: true };
}

/**
 * 10. Tolak Permohonan Izin
 */
export async function rejectLeave(id) {
  try {
    const res = await fetch(`/api/leaves/${id}/reject`, {
      method: 'PATCH',
      headers: { ...getAuthHeader() },
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, message: data.message, isMock: false };
    }
    const errData = await res.json();
    return { success: false, message: errData.message || 'Gagal menolak izin.' };
  } catch (err) {
    console.info('Backend unreachable, rejecting in mock mode:', err.message);
  }

  // Mock fallback
  localLeaves = localLeaves.map((l) =>
    l.id === Number(id) ? { ...l, status: 'rejected', reviewed_at: new Date().toISOString() } : l
  );
  return { success: true, message: 'Izin ditolak (mock).', isMock: true };
}
