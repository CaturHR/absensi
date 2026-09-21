import React, { useState, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import AttendanceLog from './components/attendance/AttendanceLog';
import UserManagement from './components/users/UserManagement';
import OfficeSettings from './components/settings/OfficeSettings';
import { checkBackendStatus } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [isBackendOnline, setIsBackendOnline] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          activeTab={activeTab}
          isBackendOnline={isBackendOnline}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto animate-rise-in">
          {activeTab === 'attendance' && <AttendanceLog />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'settings' && <OfficeSettings />}
        </main>
      </div>
    </div>
  );
}
