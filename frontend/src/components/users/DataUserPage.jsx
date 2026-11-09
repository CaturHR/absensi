import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  UserPlus,
  Edit2,
  Trash2,
  RotateCcw,
  LogOut,
  Users as UsersIcon,
  Shield,
  User,
  X,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { fetchUsers, deleteUser, updateUser } from '../../services/api';
import AddUserModal from './AddUserModal';

export default function DataUserPage({ onBack, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState('15');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', nip: '', divisi: '', password: '', role: 'user' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers();
      if (res && res.data) {
        const sorted = [...res.data].sort((a, b) => Number(a.id) - Number(b.id));
        setUsers(sorted);
      } else {
        setUsers([]);
      }
    } catch (err) {
      setUsers([]);
      showNotif('error', 'Gagal memuat data user: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleUserCreated = (newUser) => {
    setUsers((prev) => [...prev, newUser].sort((a, b) => Number(a.id) - Number(b.id)));
    showNotif('success', `User "${newUser.name}" berhasil ditambahkan.`);
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Yakin ingin menghapus user "${user.name}"? Data absensi terkait juga akan terhapus.`)) {
      try {
        await deleteUser(user.id);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        showNotif('success', `User "${user.name}" berhasil dihapus.`);
      } catch (err) {
        showNotif('error', 'Gagal menghapus user: ' + err.message);
      }
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      nip: user.nip || '',
      divisi: user.divisi || user.department || '',
      role: user.role || 'user',
      password: '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await updateUser(editingUser.id, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        nip: editForm.nip.trim(),
        divisi: editForm.divisi.trim(),
        role: editForm.role,
        ...(editForm.password ? { password: editForm.password } : {}),
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: editForm.name, email: editForm.email, nip: editForm.nip, divisi: editForm.divisi, role: editForm.role }
            : u
        )
      );
      setShowEditModal(false);
      showNotif('success', `Data user "${editForm.name}" berhasil diperbarui.`);
    } catch (err) {
      showNotif('error', 'Gagal mengupdate user: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const name = (u.name || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const nip = (u.nip || '').toLowerCase();
    const divisi = (u.divisi || '').toLowerCase();
    return name.includes(query) || email.includes(query) || nip.includes(query) || divisi.includes(query);
  });

  return (
    <div className="min-h-screen bg-[#dce6f0] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all flex items-center gap-2 cursor-pointer"
              title="Kembali ke Menu Utama"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium hidden sm:inline">Menu Utama</span>
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1e5a8a] flex items-center justify-center text-white shadow-sm shadow-blue-900/20">
                <UsersIcon size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Manajemen User</h1>
                <p className="text-xs text-gray-500">Kelola akun pegawai dan hak akses sistem</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e5a8a] hover:bg-[#174870] text-white rounded-xl font-semibold text-sm shadow-sm transition-all cursor-pointer"
            >
              <UserPlus size={17} />
              <span>Tambah User</span>
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
              title="Logout"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline font-medium">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {notification && (
          <div
            className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm animate-fade-in ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="text-xs font-bold underline cursor-pointer">
              Tutup
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Cari user berdasarkan nama, NIP, atau divisi..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all"
            />
          </div>

          <span className="text-xs font-medium text-gray-500">
            Total Pengguna: <strong className="text-gray-900">{users.length}</strong>
          </span>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4 w-14 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Lengkap</th>
                  <th className="py-3.5 px-4">NIP</th>
                  <th className="py-3.5 px-4">Email / Username</th>
                  <th className="py-3.5 px-4">Divisi</th>
                  <th className="py-3.5 px-4 text-center">Role</th>
                  <th className="py-3.5 px-4 text-center w-28">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#1e5a8a] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Memuat data pengguna...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <User size={36} className="text-gray-300" />
                        <span className="text-sm font-medium text-gray-500">Tidak ada user ditemukan</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user, index) => {
                    const rowNumber = (currentPage - 1) * (pageSize === 'all' ? 0 : parseInt(pageSize, 10)) + index + 1;
                    return (
                      <tr key={user.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3.5 px-4 text-center text-xs font-medium text-gray-500">
                          {rowNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#1e5a8a]/10 text-[#1e5a8a] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {(user.name || 'U').charAt(0)}
                            </div>
                            <span className="font-semibold text-gray-900">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                          {user.nip || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          {user.email}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
                            {user.divisi || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              <Shield size={11} /> Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              User
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit User"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus User"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add User Modal */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUserCreated={handleUserCreated}
      />

      {/* Inline Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col">
            <div className="px-6 py-5 bg-gradient-to-r from-[#1e5a8a] to-[#256ea8] text-white flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit User</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">NIP</label>
                  <input
                    type="text"
                    value={editForm.nip}
                    onChange={(e) => setEditForm({ ...editForm, nip: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 cursor-pointer"
                  >
                    <option value="user">User / Karyawan</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email / Username</label>
                <input
                  type="text"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Divisi</label>
                <input
                  type="text"
                  value={editForm.divisi}
                  onChange={(e) => setEditForm({ ...editForm, divisi: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Password Baru (Kosongkan jika tidak ingin mengubah)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    placeholder="Masukkan password baru..."
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1e5a8a] hover:bg-[#174870] rounded-xl cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
