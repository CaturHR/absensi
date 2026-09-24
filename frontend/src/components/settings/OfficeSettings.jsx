import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Compass,
  Crosshair,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Shield,
  Layers,
  Info,
  Building,
} from 'lucide-react';
import { fetchOfficeLocation, updateOfficeLocation } from '../../services/api';
import { MOCK_OFFICE_LOCATION } from '../../data/mockData';

export default function OfficeSettings() {
  const [formData, setFormData] = useState({
    name: MOCK_OFFICE_LOCATION.name,
    latitude: MOCK_OFFICE_LOCATION.latitude,
    longitude: MOCK_OFFICE_LOCATION.longitude,
    radius: MOCK_OFFICE_LOCATION.radius,
    address: MOCK_OFFICE_LOCATION.address || '',
  });

  const [loading, setLoading] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetchOfficeLocation();
        if (res && res.data) {
          setFormData({
            name: res.data.name || '',
            latitude: Number(res.data.latitude) || -6.208763,
            longitude: Number(res.data.longitude) || 106.845599,
            radius: Number(res.data.radius) || 100,
            address: res.data.address || '',
          });
        }
      } catch (e) {
        console.warn('Using default mock office settings:', e);
      }
    }
    loadData();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'radius' || name === 'latitude' || name === 'longitude'
        ? Number(value)
        : value,
    }));
  };

  // Get current GPS location using HTML5 Geolocation API
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFeedback({
        type: 'error',
        message: 'Browser Anda tidak mendukung Geolocation API.',
      });
      return;
    }

    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        }));
        setDetectingGps(false);
        setFeedback({
          type: 'success',
          message: 'Berhasil mendeteksi koordinat GPS saat ini dari perangkat.',
        });
        setTimeout(() => setFeedback(null), 4000);
      },
      (error) => {
        setDetectingGps(false);
        let msg = 'Gagal mengambil koordinat GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Izin akses lokasi ditolak oleh pengguna pada browser.';
        }
        setFeedback({ type: 'error', message: msg });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    // Validasi
    if (formData.latitude < -90 || formData.latitude > 90) {
      setFeedback({ type: 'error', message: 'Latitude harus berada antara -90 dan 90.' });
      setLoading(false);
      return;
    }
    if (formData.longitude < -180 || formData.longitude > 180) {
      setFeedback({ type: 'error', message: 'Longitude harus berada antara -180 dan 180.' });
      setLoading(false);
      return;
    }
    if (formData.radius <= 0) {
      setFeedback({ type: 'error', message: 'Radius toleransi harus lebih besar dari 0 meter.' });
      setLoading(false);
      return;
    }

    try {
      const res = await updateOfficeLocation(formData);
      if (res && res.success) {
        setFeedback({
          type: 'success',
          message: 'Konfigurasi geofencing lokasi kantor berhasil disimpan!',
        });
      } else {
        setFeedback({
          type: 'error',
          message: res?.message || 'Gagal menyimpan lokasi kantor.',
        });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const mapsPreviewUrl = `https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          Pengaturan Lokasi Kantor
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tentukan titik pusat koordinat target kantor (latitude & longitude) dan radius toleransi jarak meter untuk validasi absensi (geofencing).
        </p>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between shadow-xs animate-rise-in ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Layout Grid: Form (Left) & Radar/Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Settings */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nama Lokasi */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">
                Nama Kantor / Titik Lokasi
              </label>
              <div className="relative">
                <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Contoh: Kantor Pusat Jakarta - Gedung Menara A"
                  required
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
                />
              </div>
            </div>

            {/* GPS Coordinates Header & Auto-detect */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-moss" />
                  Titik Koordinat Pusat (WGS84)
                </span>
                <button
                  type="button"
                  onClick={handleGetCurrentLocation}
                  disabled={detectingGps}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-moss hover:text-moss/80 bg-moss/10 hover:bg-moss/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Crosshair className={`w-3.5 h-3.5 ${detectingGps ? 'animate-spin' : ''}`} />
                  {detectingGps ? 'Mendeteksi...' : 'Ambil Lokasi Saat Ini'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Latitude */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleChange}
                    placeholder="-6.208763"
                    required
                    className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Rentang: -90 s/d 90</span>
                </div>

                {/* Longitude */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleChange}
                    placeholder="106.845599"
                    required
                    className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">Rentang: -180 s/d 180</span>
                </div>
              </div>
            </div>

            {/* Radius Toleransi (Meter) */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Radius Toleransi Kehadiran (Meter)
                </label>
                <span className="text-sm font-mono font-bold text-moss bg-moss/10 px-2.5 py-0.5 rounded-md">
                  {formData.radius} Meter
                </span>
              </div>

              <div className="space-y-3">
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  name="radius"
                  value={formData.radius}
                  onChange={handleChange}
                  className="w-full accent-moss cursor-pointer"
                />

                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="number"
                    min="10"
                    max="5000"
                    name="radius"
                    value={formData.radius}
                    onChange={handleChange}
                    className="w-24 px-2 py-1 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg text-center font-semibold"
                  />
                  <span>
                    Karyawan yang berada lebih dari{' '}
                    <strong className="text-slate-800">{formData.radius} m</strong> dari titik koordinat
                    otomatis ditandai <strong className="text-rose-600">"Di Luar Radius"</strong>.
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <a
                href={mapsPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                Buka di Maps
                <ExternalLink className="w-3 h-3" />
              </a>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-moss hover:bg-moss/90 rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Simpan Pengaturan
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Visual Geofence Card / Radar Preview (Right) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="flex items-center justify-between w-full mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-moss" />
                Simulasi Radar Geofence
              </span>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Radius: {formData.radius}m
              </span>
            </div>

            {/* Simulated Radar Visual */}
            <div className="relative w-64 h-64 my-4 flex items-center justify-center">
              {/* Outermost ring */}
              <div className="absolute inset-0 rounded-full border border-slate-200/70 border-dashed" />

              {/* Geofence Tolerance Circle */}
              <div className="absolute w-44 h-44 rounded-full bg-moss/10 border-2 border-moss/60 flex items-center justify-center animate-pulse" />

              {/* Safe zone inner fill */}
              <div className="absolute w-28 h-28 rounded-full bg-emerald-500/10 border border-emerald-500/30" />

              {/* Office Center Pin */}
              <div className="relative z-10 w-10 h-10 rounded-full bg-moss text-white shadow-lg flex items-center justify-center border-2 border-white">
                <Building className="w-5 h-5" />
              </div>

              {/* Radius line indicator */}
              <div className="absolute top-1/2 left-1/2 w-22 h-px bg-moss/70 origin-left rotate-45">
                <span className="absolute -top-3.5 right-1 text-[10px] font-mono font-bold text-moss bg-white/80 px-1 rounded">
                  {formData.radius}m
                </span>
              </div>
            </div>

            {/* Quick Summary Box */}
            <div className="w-full bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs space-y-2 mt-2">
              <div className="flex items-center justify-between text-slate-600">
                <span>Pusat Geofence:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formData.latitude.toFixed(4)}, {formData.longitude.toFixed(4)}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Zona Kehadiran Valid:</span>
                <span className="font-semibold text-emerald-700">
                  Dalam Lingkaran Hijau (&le; {formData.radius}m)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Penolakan Otomatis:</span>
                <span className="font-semibold text-rose-600">
                  Di Luar Lingkaran (&gt; {formData.radius}m)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Presets for Demo */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              Pilihan Preset Cepat (Uji Coba)
            </h4>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    name: 'Kantor Pusat Jakarta (Kuningan)',
                    latitude: -6.208763,
                    longitude: 106.845599,
                    radius: 100,
                  }))
                }
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-moss/50 hover:bg-slate-50 transition-colors text-xs flex justify-between items-center"
              >
                <div>
                  <strong className="text-slate-700 block">Kantor Pusat Jakarta</strong>
                  <span className="text-slate-400 font-mono text-[11px]">-6.208763, 106.845599 (Radius: 100m)</span>
                </div>
                <span className="text-moss font-medium">Terapkan</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    name: 'Cabang SCBD Jakarta',
                    latitude: -6.226310,
                    longitude: 106.809180,
                    radius: 80,
                  }))
                }
                className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-moss/50 hover:bg-slate-50 transition-colors text-xs flex justify-between items-center"
              >
                <div>
                  <strong className="text-slate-700 block">Cabang SCBD Sudirman</strong>
                  <span className="text-slate-400 font-mono text-[11px]">-6.226310, 106.809180 (Radius: 80m)</span>
                </div>
                <span className="text-moss font-medium">Terapkan</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
