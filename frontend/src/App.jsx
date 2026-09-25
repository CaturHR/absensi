import React, { useState, useEffect } from 'react';
import LoginPage from './components/layout/LoginPage';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import AttendanceLog from './components/attendance/AttendanceLog';
import UserManagement from './components/users/UserManagement';
import OfficeSettings from './components/settings/OfficeSettings';
import LeaveApproval from './components/leaves/LeaveApproval';
import { checkBackendStatus } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if user is already logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('admin_user');
    if (token && savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user.role === 'admin') {
          setAdminUser(user);
          setIsLoggedIn(true);
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('admin_user');
      }
    }
    setCheckingAuth(false);
  }, []);

  // Check backend server status periodically
  useEffect(() => {
    async function checkStatus() {
      const online = await checkBackendStatus();
      setIsBackendOnline(online);
    }
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginSuccess = (user) => {
    setAdminUser(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin_user');
    setIsLoggedIn(false);
    setAdminUser(null);
    setActiveTab('attendance');
  };

  // Tampilkan loading saat cek auth awal
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#f7f7f2] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-moss border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Tampilkan halaman login jika belum login
  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#f7f7f2] flex flex-col lg:flex-row text-slate-800 font-sans antialiased selection:bg-moss/20 selection:text-moss">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-ink/50 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Responsive) */}
      <div
        className={`fixed lg:static inset-y-0 left-0 z-50 transform ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-200 ease-in-out`}
      >
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false);
          }}
          isBackendOnline={isBackendOnline}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          isBackendOnline={isBackendOnline}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          adminUser={adminUser}
          onLogout={handleLogout}
          onSelectTab={setActiveTab}
        />

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto animate-rise-in">
          {activeTab === 'attendance' && <AttendanceLog />}
          {activeTab === 'leaves' && <LeaveApproval />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'settings' && <OfficeSettings />}
        </main>
      </div>
    </div>
  );
}
