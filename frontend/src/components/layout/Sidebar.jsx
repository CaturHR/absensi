import React from 'react';
import {
  ClipboardList,
  Users,
  MapPin,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab, isBackendOnline, onLogout }) {
  // Ambil data admin dari localStorage
  let adminName = 'Administrator';
  let adminEmail = 'admin@absensi.com';
  try {
    const savedUser = localStorage.getItem('admin_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      adminName = user.name || 'Administrator';
      adminEmail = user.email || 'admin@absensi.com';
    }
  } catch {}

  const menuItems = [
    {
      id: 'attendance',
      label: 'Log Absensi',
      sublabel: 'Riwayat & Validasi AI',
      icon: ClipboardList,
      badge: 'Real-time',
    },
    {
      id: 'users',
      label: 'Manajemen User',
      sublabel: 'Data & Foto Wajah',
      icon: Users,
    },
    {
      id: 'settings',
      label: 'Pengaturan Kantor',
      sublabel: 'Geofence & Radius',
      icon: MapPin,
    },
  ];

  return (
    <aside className="w-full lg:w-72 bg-white lg:min-h-screen border-r border-slate-200/80 flex flex-col justify-between shrink-0">
      {/* Top Branding */}
      <div>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-moss text-white flex items-center justify-center shadow-md">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-800 block">
                Presensi<span className="text-moss">HQ</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono tracking-tight block">
                Face & Geofence Admin
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="p-4 space-y-1.5">
          <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 block">
            Menu Utama
          </span>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-moss text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-sm leading-tight">{item.label}</span>
                    <span
                      className={`block text-[11px] ${
                        isActive ? 'text-white/80' : 'text-slate-400'
                      }`}
                    >
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Profile / Backend Status */}
      <div className="p-4 border-t border-slate-100 space-y-3">
        {/* Backend Connectivity Card */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-slate-500 font-medium">Status Server Backend</span>
            <span className="flex items-center gap-1.5 font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  isBackendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className={isBackendOnline ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                {isBackendOnline ? 'Online (5000)' : 'Mock Mode'}
              </span>
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {isBackendOnline
              ? 'Terhubung dengan Express.js API'
              : 'Backend offline: berjalan menggunakan mock data interaktif'}
          </p>
        </div>

        {/* User Admin Info */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-full bg-moss/15 flex items-center justify-center text-moss font-bold text-sm border border-moss/20">
            {adminName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="block text-xs font-bold text-slate-800 truncate">
              {adminName}
            </span>
            <span className="block text-[11px] text-slate-400 font-mono truncate">
              {adminEmail}
            </span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
