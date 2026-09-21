import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  UserPlus,
  Upload,
  Camera,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { createUser } from '../../services/api';

export default function AddUserModal({ isOpen, onClose, onUserCreated }) {
  const [formData, setFormData] = useState({
    name: '',
    nip: '',
    email: '',
    password: '',
    role: 'user',
    department: 'Engineering',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [faceFile, setFaceFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        nip: '',
        email: '',
        password: '',
        role: 'user',
        department: 'Engineering',
      });
      setFaceFile(null);
      setPreviewUrl(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  // ESC key dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const processFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Harap pilih file gambar wajah yang valid (.jpg, .jpeg, .png).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran file maksimal 5 MB.');
      return;
    }

    setErrorMsg('');
    setFaceFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const handleRemovePhoto = () => {
    setFaceFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Validasi dasar
    if (!formData.name.trim()) {
      setErrorMsg('Nama lengkap wajib diisi.');
      return;
    }
    if (!formData.nip.trim()) {
      setErrorMsg('NIP pegawai wajib diisi.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMsg('Alamat email wajib diisi.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.');
      return;
    }
    if (!faceFile) {
      setErrorMsg('Foto master wajah wajib diunggah untuk keperluan verifikasi AI.');
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append('name', formData.name.trim());
      data.append('nip', formData.nip.trim());
      data.append('email', formData.email.trim());
      data.append('password', formData.password);
      data.append('role', formData.role);
      data.append('department', formData.department);
      data.append('face_photo', faceFile);

      const res = await createUser(data);
      if (res && res.success) {
        if (onUserCreated) onUserCreated(res.data);
        onClose();
      } else {
        setErrorMsg(res?.message || 'Gagal menambahkan user baru.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat menyimpan user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-rise-in"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-moss/10 text-moss flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="add-user-title" className="text-lg font-bold text-slate-800">
                Tambah Karyawan Baru
              </h3>
              <p className="text-xs text-slate-500">
                Lengkapi identitas dan unggah foto master wajah untuk AI Face Recognition
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[calc(85vh-130px)] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Nama Lengkap <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Contoh: Rian Pratama"
                required
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
              />
            </div>

            {/* NIP & Email (2 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  NIP Pegawai <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="nip"
                  value={formData.nip}
                  onChange={handleInputChange}
                  placeholder="PEG-2024-001"
                  required
                  className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Email Perusahaan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="nama@perusahaan.co.id"
                  required
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
                />
              </div>
            </div>

            {/* Password & Role (2 columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Kata Sandi Akun <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="Min. 6 karakter"
                    required
                    className="w-full pl-3.5 pr-10 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                  Role Pengguna
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss cursor-pointer"
                >
                  <option value="user">Karyawan (User)</option>
                  <option value="admin">Administrator (Admin)</option>
                </select>
              </div>
            </div>

            {/* Departemen */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Departemen / Divisi
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                placeholder="Contoh: Engineering, HR, Operasional"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
              />
            </div>

            {/* Upload Master Foto Wajah */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Foto Master Wajah Biometrik <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400">JPG, PNG (Maks. 5MB)</span>
              </div>

              {/* Drag and Drop Zone or Preview */}
              {!previewUrl ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-moss bg-moss/5 scale-[0.99]'
                      : 'border-slate-300 hover:border-moss hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/jpg"
                    className="hidden"
                  />
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3 group-hover:text-moss">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    Klik untuk memilih foto atau seret ke sini
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Pastikan wajah terlihat jelas, menghadap depan, dan pencahayaan terang.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-white shadow-sm shrink-0 bg-slate-200">
                    <img
                      src={previewUrl}
                      alt="Preview Wajah Master"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {faceFile?.name || 'master_face.jpg'}
                    </p>
                    <p className="text-xs text-slate-500 font-mono">
                      {(faceFile?.size ? (faceFile.size / 1024).toFixed(1) : '0')} KB · Foto Siap Diunggah
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-moss hover:underline font-medium"
                      >
                        Ganti Foto
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-xs text-rose-600 hover:underline font-medium inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/jpeg,image/png,image/jpg"
                    className="hidden"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Footer Action */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-moss hover:bg-moss/90 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Pengguna</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
