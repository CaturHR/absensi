import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  AlertCircle,
  Shield,
  Trash2,
  Sparkles,
  Camera,
  RefreshCw,
} from 'lucide-react';
import AddUserModal from './AddUserModal';
import { fetchUsers, deleteUser } from '../../services/api';
import { MOCK_USERS } from '../../data/mockData';
import { getImageUrl } from '../../utils/image';

export default function UserManagement() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers();
      if (res && res.data) {
        setUsers(res.data);
      }
    } catch {
      setUsers(MOCK_USERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUserCreated = (newUser) => {
    setUsers((prev) => [newUser, ...prev]);
    setNotification({
      type: 'success',
      message: `Karyawan "${newUser.name}" berhasil ditambahkan ke sistem.`,
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Yakin ingin menghapus pegawai "${user.name}" (${user.nip})?`)) {
      try {
        await deleteUser(user.id);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        setNotification({
          type: 'info',
          message: `Karyawan "${user.name}" telah dihapus.`,
        });
        setTimeout(() => setNotification(null), 4000);
      } catch (err) {
        alert('Gagal menghapus pengguna: ' + err.message);
      }
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.nip.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-xs animate-rise-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Manajemen Pengguna & Karyawan
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola data akun pegawai dan foto referensi master untuk pengenalan wajah biometrik.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 bg-white transition-colors"
            title="Muat Ulang"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-moss hover:bg-moss/95 rounded-xl shadow-xs transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Tambah Karyawan Baru
          </button>
        </div>
      </div>

      {/* Search and Summary */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, NIP, email, atau username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>
            Total: <strong className="text-slate-800">{users.length}</strong> Karyawan
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {users.filter((u) => u.face_photo).length} Foto Master Aktif
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 sm:px-6">Karyawan</th>
                <th className="py-3.5 px-4">NIP</th>
                <th className="py-3.5 px-4">Departemen</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Foto Master Wajah</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <Users className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">Tidak ada pegawai yang cocok</p>
                      <p className="text-xs text-slate-400 mt-1">Gunakan kata kunci lain atau tambahkan karyawan baru.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const hasPhoto = Boolean(user.face_photo);
                  const isAdmin = user.role === 'admin';

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                            {hasPhoto ? (
                              <img
                                src={getImageUrl(user.face_photo)}
                                alt={user.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = 'none';
                                  if (e.target.nextElementSibling) {
                                    e.target.nextElementSibling.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-100 font-bold"
                              style={{ display: hasPhoto ? 'none' : 'flex' }}
                            >
                              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                          </div>
                          <div>
                            <span className="font-medium text-slate-800 block">
                              {user.name}
                            </span>
                            <span className="text-xs text-slate-400">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* NIP */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {user.nip}
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {user.department || user.position || '-'}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Karyawan
                          </span>
                        )}
                      </td>

                      {/* Master Face Status */}
                      <td className="py-3.5 px-4">
                        {hasPhoto ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Terdaftar
                            </span>
                            <div className="w-7 h-7 rounded-md overflow-hidden border border-slate-200 bg-slate-100">
                              <img
                                src={getImageUrl(user.face_photo)}
                                alt="Master"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3 h-3" />
                            Belum Ada Foto
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Hapus Karyawan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUserCreated={handleUserCreated}
      />
    </div>
  );
}
