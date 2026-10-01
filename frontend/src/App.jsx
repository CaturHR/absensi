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

  // Inisialisasi notifikasi real-time setelah admin login
  useEffect(() => {
    if (isLoggedIn && adminUser) {
      initRealtimeNotification().then((result) => {
        console.log('Realtime notification status:', result.status, result.message);
      });
    }
    return () => {
      disconnectRealtimeNotification();
    };
  }, [isLoggedIn, adminUser]);

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
  };

  const handleSelectMenu = (menuId) => {
    // 5 Menu Utama Sesuai Gambar:
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
}
