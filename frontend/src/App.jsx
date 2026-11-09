import React, { useState, useEffect } from 'react';
import LoginPage from './components/layout/LoginPage';
import MenuAbsensi from './components/layout/MenuAbsensi';
import DataUserPage from './components/users/DataUserPage';
import LogAbsenPage from './components/attendance/LogAbsenPage';

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

        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          localStorage.removeItem('admin_user');
          setIsLoggedIn(false);
          setAdminUser(null);
        } else if (user.role === 'admin') {
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

  const handleLoginSuccess = (user) => {
    setAdminUser(user);
    setIsLoggedIn(true);
    setShowMenu(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_user');
    setIsLoggedIn(false);
    setAdminUser(null);
    setActiveTab(null);
    setShowMenu(true);
  };

  const handleSelectMenu = (menuId) => {
    // Menu Admin Web:
    // 1. users      -> Manajemen User (DataUserPage)
    // 2. attendance -> Melihat Log Absen (LogAbsenPage)
    setActiveTab(menuId);
    setShowMenu(false);
  };

  const handleBackToMenu = () => {
    setShowMenu(true);
    setActiveTab(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#dce6f0] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#1e5a8a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const renderCurrentView = () => {
    if (showMenu || !activeTab) {
      return <MenuAbsensi onSelectMenu={handleSelectMenu} onLogout={handleLogout} />;
    }

    // 1. Menu: Manajemen User
    if (activeTab === 'users') {
      return <DataUserPage onBack={handleBackToMenu} onLogout={handleLogout} />;
    }

    // 2. Menu: Melihat Log Absen
    if (activeTab === 'attendance') {
      return <LogAbsenPage onBack={handleBackToMenu} onLogout={handleLogout} />;
    }

    return <MenuAbsensi onSelectMenu={handleSelectMenu} onLogout={handleLogout} />;
  };

  return (
    <div className="relative">
      {renderCurrentView()}
    </div>
  );
}
