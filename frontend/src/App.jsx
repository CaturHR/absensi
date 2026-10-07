import React, { useState, useEffect } from 'react';
import LoginPage from './components/layout/LoginPage';
import MenuAbsensi from './components/layout/MenuAbsensi';
import DataUserPage from './components/users/DataUserPage';
import DataIzinPage from './components/leaves/DataIzinPage';
import TambahLokasiPage from './components/settings/TambahLokasiPage';
import ExportDataPage from './components/export/ExportDataPage';
import KecocokanWajahPage from './components/face/KecocokanWajahPage';
import { initRealtimeNotification, disconnectRealtimeNotification } from './services/pushNotification';

export default function App() {
  const [activeTab, setActiveTab] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showMenu, setShowMenu] = useState(true);

  // Check if user is already logged in on mount with token verification
  useEffect(() => {
    async function verifyAuth() {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('admin_user');

      if (!token || !savedUser) {
        setCheckingAuth(false);
        return;
      }

      try {
        const user = JSON.parse(savedUser);
        // Cek validitas token ke backend
        const res = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const profileData = await res.json();
          if (profileData.data?.role === 'admin') {
            setAdminUser(profileData.data);
            setIsLoggedIn(true);
            setCheckingAuth(false);
            return;
          }
        }

        // Jika status 401/403 (token kedaluwarsa atau bukan admin)
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('admin_user');
          setIsLoggedIn(false);
          setAdminUser(null);
        } else if (user.role === 'admin') {
          // Jika server sedang offline, izinkan session offline
          setAdminUser(user);
          setIsLoggedIn(true);
        }
      } catch {
        try {
          const user = JSON.parse(savedUser);
          if (user.role === 'admin') {
            setAdminUser(user);
            setIsLoggedIn(true);
          }
        } catch {}
      } finally {
        setCheckingAuth(false);
      }
    }

    verifyAuth();

    const handleUnauthorized = () => {
      setIsLoggedIn(false);
      setAdminUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const [inAppNotif, setInAppNotif] = useState(null);

  // Inisialisasi notifikasi real-time setelah admin login
  useEffect(() => {
    if (isLoggedIn && adminUser) {
      initRealtimeNotification().then((result) => {
        if (result?.status === 'connected') {
          console.log('[App] Realtime notification active.');
        }
      });
    }
    return () => {
      disconnectRealtimeNotification();
    };
  }, [isLoggedIn, adminUser?.id]);

  // Listener untuk event notifikasi izin dan navigasi dari notifikasi
  useEffect(() => {
    const handleOpenLeaves = () => {
      setActiveTab('leaves');
      setShowMenu(false);
      setInAppNotif(null);
    };

    const handleLeaveRequest = (e) => {
      const data = e.detail;
      if (data) {
        setInAppNotif(data);
      }
    };

    window.addEventListener('app:open-leaves-tab', handleOpenLeaves);
    window.addEventListener('app:leave-request', handleLeaveRequest);

    return () => {
      window.removeEventListener('app:open-leaves-tab', handleOpenLeaves);
      window.removeEventListener('app:leave-request', handleLeaveRequest);
    };
  }, []);

  // Otomatis hilangkan banner toast in-app setelah 7 detik
  useEffect(() => {
    if (!inAppNotif) return;
    const timer = setTimeout(() => {
      setInAppNotif(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [inAppNotif]);

  const handleLoginSuccess = (user) => {
    setAdminUser(user);
    setIsLoggedIn(true);
    setShowMenu(true);
  };

  const handleLogout = () => {
    disconnectRealtimeNotification();
    localStorage.removeItem('token');
    localStorage.removeItem('admin_user');
    setIsLoggedIn(false);
    setAdminUser(null);
    setActiveTab(null);
    setShowMenu(true);
    setInAppNotif(null);
  };

  const handleSelectMenu = (menuId) => {
    // 5 Menu Utama:
    // 1. leaves -> Izin (DataIzinPage)
    // 2. users -> Tambah User (DataUserPage)
    // 3. settings -> Tambah Titik Lokasi (TambahLokasiPage)
    // 4. export -> Export Data (ExportDataPage)
    // 5. face -> Kecocokan Wajah (KecocokanWajahPage)
    setActiveTab(menuId);
    setShowMenu(false);
  };

  const handleBackToMenu = () => {
    setShowMenu(true);
    setActiveTab(null);
  };

  // Loading indicator saat cek status autentikasi
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#dce6f0] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1e5a8a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Tampilkan halaman Login jika belum terautentikasi
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const renderCurrentView = () => {
    // Tampilkan Menu Absensi (Hub 5 Menu) setelah login atau saat kembali
    if (showMenu || !activeTab) {
      return <MenuAbsensi onSelectMenu={handleSelectMenu} onLogout={handleLogout} />;
    }

    // 1. Menu: Izin
    if (activeTab === 'leaves') {
      return <DataIzinPage onBack={handleBackToMenu} onLogout={handleLogout} />;
    }

    // 2. Menu: Tambah User
    if (activeTab === 'users') {
      return <DataUserPage onBack={handleBackToMenu} onLogout={handleLogout} />;
    }

    // 3. Menu: Tambah Titik Lokasi
    if (activeTab === 'settings') {
      return <TambahLokasiPage onBack={handleBackToMenu} onLogout={handleLogout} />;
    }

    // 4. Menu: Export Data
    if (activeTab === 'export') {
      return <ExportDataPage onBack={handleBackToMenu} onLogout={handleLogout} />;
    }

    // 5. Menu: Kecocokan Wajah
    if (activeTab === 'face') {
      return <KecocokanWajahPage onBack={handleBackToMenu} onLogout={handleLogout} />;
    }

    // Fallback ke Menu Utama
    return <MenuAbsensi onSelectMenu={handleSelectMenu} onLogout={handleLogout} />;
  };

  return (
    <div className="relative">
      {renderCurrentView()}

      {/* Floating In-App Toast Notification */}
      {inAppNotif && (
        <div
          role="alert"
          className="fixed top-5 right-5 z-[9999] max-w-sm w-full bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-blue-100 flex items-start gap-3.5 animate-bounce-in transition-all"
          style={{ animation: 'slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shrink-0">
            📋
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 leading-tight">
              {inAppNotif.title || 'Permohonan Izin Baru'}
            </h4>
            <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
              {inAppNotif.body || `${inAppNotif.userName || 'Karyawan'} mengajukan izin: ${inAppNotif.reason || '-'}`}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('leaves');
                  setShowMenu(false);
                  setInAppNotif(null);
                }}
                className="px-3 py-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
              >
                Lihat Izin →
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setInAppNotif(null)}
            className="text-gray-400 hover:text-gray-700 text-sm font-bold p-1 rounded-md transition-colors"
            title="Tutup"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
