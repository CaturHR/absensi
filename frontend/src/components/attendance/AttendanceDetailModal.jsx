import React, { useEffect } from 'react';
import {
  X,
  MapPin,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Clock,
  User,
  Copy,
  Check,
  Navigation,
  Sparkles,
  Info,
} from 'lucide-react';

export default function AttendanceDetailModal({ attendance, onClose }) {
  const [copied, setCopied] = React.useState(false);

  // Keyboard accessibility: ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!attendance) return null;

  const handleCopyCoords = () => {
    const text = `${attendance.latitude}, ${attendance.longitude}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPresent = attendance.status === 'Hadir';
  const isOutOfRadius = attendance.status === 'Di Luar Radius';
  const isMismatch = attendance.status === 'Wajah Tidak Cocok' || attendance.status === 'Gagal Verifikasi Wajah';

  const dateObj = new Date(attendance.created_at || Date.now());
  const formattedDate = dateObj.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = dateObj.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const mapsUrl = `https://www.google.com/maps?q=${attendance.latitude},${attendance.longitude}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-rise-in"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                isPresent
                  ? 'bg-emerald-600'
                  : isOutOfRadius
                  ? 'bg-rose-600'
                  : 'bg-amber-600'
              }`}
            >
              {isPresent ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 id="modal-title" className="text-lg font-bold text-slate-800">
                Detail Presensi Karyawan
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Log ID: #{attendance.id} · Ref: {attendance.user_nip || 'NIP-00'}
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

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[calc(85vh-120px)] overflow-y-auto">
          {/* Employee & Status Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-200">
                <img
                  src={attendance.master_photo || attendance.photo}
                  alt={attendance.user_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 text-base">
                  {attendance.user_name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{attendance.user_nip}</span>
                  <span>•</span>
                  <span>{attendance.department || 'Staff'}</span>
                </div>
              </div>
            </div>

            {/* Status Pill */}
            <div>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  isPresent
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : isOutOfRadius
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {isPresent && <ShieldCheck className="w-3.5 h-3.5" />}
                {isOutOfRadius && <MapPin className="w-3.5 h-3.5" />}
                {isMismatch && <ShieldAlert className="w-3.5 h-3.5" />}
                {attendance.status}
              </span>
            </div>
          </div>

          {/* Biometric Comparison: Master Photo vs Attendance Photo */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-moss" />
                <h5 className="text-sm font-bold text-slate-800 tracking-tight">
                  Komparasi Verifikasi Wajah (Face Recognition)
                </h5>
              </div>
              {attendance.face_confidence !== null && (
                <span
                  className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full ${
                    attendance.face_confidence >= 75
                      ? 'bg-emerald-100 text-emerald-800'
                      : attendance.face_confidence >= 50
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  Kecocokan: {attendance.face_confidence}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Master Reference Photo */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Foto Master (Profil Terdaftar)
                </span>
                <div className="relative w-full aspect-square max-h-52 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                  <img
                    src={attendance.master_photo || attendance.photo}
                    alt="Foto Master Pegawai"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded font-mono">
                    Master Baseline
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  Foto referensi resmi tersimpan di database
                </p>
              </div>

              {/* Attendance Captured Photo */}
              <div className="border border-slate-200 rounded-xl p-3 bg-white shadow-sm flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Foto Absensi (Saat Presensi)
                </span>
                <div className="relative w-full aspect-square max-h-52 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                  <img
                    src={attendance.photo}
                    alt="Foto Saat Absen"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded font-mono">
                    Tangkapan Kamera
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  Diambil secara langsung dari perangkat pegawai
                </p>
              </div>
            </div>

            {/* Confidence Bar */}
            {attendance.face_confidence !== null ? (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <div className="flex justify-between text-xs mb-1.5 font-medium">
                  <span className="text-slate-600">
                    Tingkat Akurasi AI Kemiripan Wajah:
                  </span>
                  <span className="font-bold text-slate-800">
                    {attendance.face_confidence}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 rounded-full ${
                      attendance.face_confidence >= 75
                        ? 'bg-emerald-500'
                        : attendance.face_confidence >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(attendance.face_confidence, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400" />
                  Ambang batas minimal lolos verifikasi adalah 60.0%.
                </p>
              </div>
            ) : (
              <div className="mt-3 p-3 bg-rose-50 text-rose-700 rounded-xl border border-rose-100 text-xs">
                Verifikasi wajah tidak diproses karena pegawai berada di luar radius geofence.
              </div>
            )}
          </div>

          {/* Location & Geofence Coordinates */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Navigation className="w-4 h-4 text-moss" />
              <h5 className="text-sm font-bold text-slate-800 tracking-tight">
                Lokasi GPS & Status Geofencing
              </h5>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Coordinates Pill */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-slate-500 font-medium mb-1">
                  Koordinat Lokasi (GPS)
                </span>
                <div className="flex items-center justify-between font-mono font-medium text-slate-800 text-sm">
                  <span>
                    {attendance.latitude?.toFixed(6)}, {attendance.longitude?.toFixed(6)}
                  </span>
                  <button
                    onClick={handleCopyCoords}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-500 hover:text-slate-800"
                    title="Salin Koordinat"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Lat: {attendance.latitude} | Lng: {attendance.longitude}
                </div>
              </div>

              {/* Distance from Office */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                <span className="text-slate-500 font-medium mb-1">
                  Jarak ke Titik Kantor
                </span>
                <div className="flex items-center justify-between font-mono text-sm font-semibold">
                  <span
                    className={
                      attendance.distance <= 100
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }
                  >
                    {attendance.distance} meter
                  </span>
                  <span className="text-xs font-normal text-slate-500">
                    Batas Maks: 100m
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {attendance.distance <= 100
                    ? '✓ Berada di dalam radius toleransi kantor'
                    : '✗ Terdeteksi di luar zona kantor yang diizinkan'}
                </div>
              </div>
            </div>

            {/* Timestamps & Map Action */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{formattedDate}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{formattedTime} WIB</span>
                </div>
              </div>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-medium rounded-lg border border-slate-300 shadow-xs transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Buka di Google Maps
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
