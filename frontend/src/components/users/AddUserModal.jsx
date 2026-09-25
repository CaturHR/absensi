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
  RefreshCw,
  RotateCw,
  Video,
  VideoOff,
  Sparkles,
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
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
    setCameraError(null);
  };

  const startCamera = async (mode = facingMode) => {
    stopCamera();
    setCameraLoading(true);
    setCameraError(null);
    setIsCameraActive(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser Anda tidak mendukung akses kamera secara langsung. Silakan gunakan opsi upload file.');
      }

      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (_) {}
      }
      setCameraLoading(false);
    } catch (err) {
      console.error('Camera access error:', err);
      let message = 'Tidak dapat membuka kamera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Izin kamera ditolak. Harap izinkan akses kamera di pengaturan browser Anda.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Perangkat kamera tidak terdeteksi pada sistem Anda.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message = 'Kamera sedang digunakan oleh aplikasi lain.';
      } else {
        message = err.message || 'Gagal memulai kamera.';
      }
      setCameraError(message);
      setCameraLoading(false);
    }
  };

  const switchCamera = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Cermin gambar jika kamera depan agar sesuai dengan preview
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `master_face_${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      processFile(file);
      stopCamera();
    }, 'image/jpeg', 0.95);
  };

  // Reset form & stop camera when modal opens/closes
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
      stopCamera();
    } else {
      stopCamera();
    }
  }, [isOpen]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
      setErrorMsg('Email atau nama pengguna wajib diisi.');
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
                  Email / Nama Pengguna <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="nama_pengguna atau email@perusahaan.co.id"
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

              {/* Drag and Drop Zone or Live Camera View or Preview */}
              {!previewUrl ? (
                isCameraActive ? (
                  <div className="relative border-2 border-moss rounded-2xl overflow-hidden bg-slate-950 shadow-md">
                    {/* Video Viewfinder */}
                    <div className="relative w-full h-72 bg-black flex items-center justify-center overflow-hidden">
                      {cameraLoading && (
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/90 text-white gap-3">
                          <RefreshCw className="w-8 h-8 text-moss animate-spin" />
                          <p className="text-xs font-medium tracking-wide">Membuka kamera...</p>
                        </div>
                      )}

                      {cameraError ? (
                        <div className="p-6 text-center text-white z-20 flex flex-col items-center">
                          <AlertCircle className="w-10 h-10 text-rose-500 mb-2" />
                          <p className="text-xs text-rose-200 mb-4 max-w-xs">{cameraError}</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startCamera()}
                              className="px-3 py-1.5 bg-moss hover:bg-moss/90 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              Coba Lagi
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors"
                            >
                              Batal & Upload File
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                          />

                          {/* Biometric Oval Guide Overlay */}
                          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                            <div className="w-36 h-48 sm:w-44 sm:h-56 rounded-[50%] border-2 border-dashed border-emerald-400/90 shadow-[0_0_20px_rgba(52,211,153,0.35)] relative flex items-center justify-center">
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Posisikan Wajah
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Camera Control Footer */}
                    <div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" />
                        Batal
                      </button>

                      <button
                        type="button"
                        onClick={capturePhoto}
                        disabled={cameraLoading || Boolean(cameraError)}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-900/40 active:scale-95 transition-all disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4" />
                        Ambil Foto Wajah
                      </button>

                      <button
                        type="button"
                        onClick={switchCamera}
                        disabled={cameraLoading || Boolean(cameraError)}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Beralih Kamera Depan / Belakang"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
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
                      capture="user"
                      className="hidden"
                    />

                    {/* Action buttons */}
                    <div className="flex flex-col items-center">
                      <div className="flex flex-wrap items-center justify-center gap-3 mb-3">
                        <button
                          type="button"
                          onClick={() => startCamera('user')}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-moss hover:bg-moss/95 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all active:scale-95"
                        >
                          <Camera className="w-4 h-4" />
                          Buka Kamera Langsung
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-2xs transition-all"
                        >
                          <Upload className="w-4 h-4 text-slate-500" />
                          Pilih File Foto
                        </button>
                      </div>

                      <p className="text-xs text-slate-500">
                        Atau seret dan lepas file gambar ke dalam area ini
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Pastikan wajah terlihat jelas, menghadap depan, dan pencahayaan terang.
                      </p>
                    </div>
                  </div>
                )
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
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => startCamera('user')}
                        className="text-xs text-moss hover:text-moss/80 font-semibold inline-flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" /> Ambil Ulang Kamera
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-slate-600 hover:text-slate-800 font-medium inline-flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" /> Ganti File
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
                    capture="user"
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
