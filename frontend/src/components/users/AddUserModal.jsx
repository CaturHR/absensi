import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  Building,
  Mail,
  User,
  Hash,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { createUser } from '../../services/api';

export default function AddUserModal({ isOpen, onClose, onUserCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    nip: '',
    email: '',
    password: '',
    role: 'user',
    divisi: 'Engineering',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errorMsg) setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.name.trim()) {
      setErrorMsg('Nama lengkap wajib diisi.');
      return;
    }
    if (!formData.nip.trim()) {
      setErrorMsg('NIP wajib diisi.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMsg('Email / Username wajib diisi.');
      return;
    }
    if (!formData.password || formData.password.length < 4) {
      setErrorMsg('Password minimal 4 karakter.');
      return;
    }

    setLoading(true);
    try {
      const res = await createUser({
        name: formData.name.trim(),
        nip: formData.nip.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        divisi: formData.divisi,
      });

      if (res && res.data) {
        onUserCreated(res.data);
        handleClose();
      } else {
        throw new Error('Gagal menambahkan user.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan user.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      nip: '',
      email: '',
      password: '',
      role: 'user',
      divisi: 'Engineering',
    });
    setErrorMsg('');
    setShowPassword(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#1e5a8a] to-[#256ea8] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <UserPlus size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Tambah Pengguna Baru</h3>
              <p className="text-xs text-blue-100">Daftarkan akun karyawan atau admin baru</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-600 font-medium">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Nama Lengkap */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Contoh: Ahmad Fauzi"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all"
                required
              />
            </div>
          </div>

          {/* NIP & Role */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                NIP Pegawai <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  name="nip"
                  value={formData.nip}
                  onChange={handleChange}
                  placeholder="Contoh: 19850101"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Role Akses
              </label>
              <div className="relative">
                <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all cursor-pointer"
                >
                  <option value="user">User / Karyawan</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>
          </div>

          {/* Email / Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email / Username Login <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="nama@email.com atau username"
                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all"
                required
              />
            </div>
          </div>

          {/* Divisi & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Divisi / Departemen
              </label>
              <div className="relative">
                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  name="divisi"
                  value={formData.divisi}
                  onChange={handleChange}
                  placeholder="Contoh: IT, HR, Sales"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimal 4 karakter"
                  className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-[#1e5a8a] hover:bg-[#174870] rounded-xl shadow-md shadow-blue-900/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan User</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
