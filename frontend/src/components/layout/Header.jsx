import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Sparkles,
  Server,
  Activity,
  Bell,
  Menu,
} from 'lucide-react';

export default function Header({ activeTab, isBackendOnline, onToggleMobileMenu }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDate = time.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const getTitle = () => {
    switch (activeTab) {
      case 'attendance':
        return 'Riwayat & Monitoring Presensi';
      case 'users':
        return 'Manajemen Karyawan & Biometrik';
      case 'settings':
        return 'Pengaturan Geofencing Kantor';
      default:
        return 'Dashboard Admin';
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-800 lg:hidden hover:bg-slate-100"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
            {getTitle()}
          </h2>
          <p className="text-xs text-slate-400 hidden sm:block">
            Sistem Verifikasi Absensi Wajah & Koordinat Lokasi
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl text-xs text-slate-600 font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formattedDate}</span>
          <span className="text-slate-300">•</span>
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-slate-800">{formattedTime} WIB</span>
        </div>

        {/* Backend / Mock Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
            isBackendOnline
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={
            isBackendOnline
              ? 'Terhubung dengan Express Backend (:5000)'
              : 'Menggunakan Mock Data JSON'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendOnline ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'
            }`}
          />
          <span className="hidden sm:inline">
            {isBackendOnline ? 'API Connected' : 'Mock Preview Mode'}
          </span>
          <span className="sm:hidden">
            {isBackendOnline ? 'Live' : 'Mock'}
          </span>
        </div>
      </div>
    </header>
  );
}
