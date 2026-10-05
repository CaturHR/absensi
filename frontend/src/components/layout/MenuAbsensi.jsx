import React from 'react';

const menuItems = [
  {
    id: 'leaves',
    label: 'Approval Izin',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 7l-10 7L2 7" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Tambah User',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="19" y1="8" x2="19" y2="14" />
        <line x1="22" y1="11" x2="16" y2="11" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Tambah Titik Lokasi',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    ),
  },
  {
    id: 'export',
    label: 'Export Data',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    id: 'face',
    label: 'Approval Not Match',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M2 2l2 2" />
        <path d="M22 2l-2 2" />
        <path d="M15 12a3 3 0 0 0-6 0" />
      </svg>
    ),
  },
];

export default function MenuAbsensi({ onSelectMenu, onLogout }) {
  return (
    <div style={styles.wrapper}>
      {/* Top Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <div style={styles.headerLogo}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" />
                <path d="M16 6h.01" />
                <path d="M12 6h.01" />
                <path d="M12 10h.01" />
                <path d="M12 14h.01" />
                <path d="M16 10h.01" />
                <path d="M16 14h.01" />
                <path d="M8 10h.01" />
                <path d="M8 14h.01" />
              </svg>
            </div>
            <div>
              <h1 style={styles.headerTitle}>PT Poca Jaringan Solusi</h1>
              <p style={styles.headerSubtitle}>Sistem Absensi Karyawan</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={styles.logoutBtn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.centerContent}>
          <h2 style={styles.menuTitle}>Menu Absensi</h2>
          <p style={styles.menuSubtitle}>Pilih salah satu menu di bawah ini</p>

          <div style={styles.cardsRow}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                style={styles.card}
                onClick={() => onSelectMenu(item.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 12px 32px rgba(30, 90, 138, 0.15)';
                  e.currentTarget.style.borderColor = '#1e5a8a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.04)';
                  e.currentTarget.style.borderColor = '#e8ecf1';
                }}
              >
                <div style={styles.iconCircle}>
                  {item.icon}
                </div>
                <span style={styles.cardLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    background: '#dce6f0',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0,
    padding: 0,
    boxSizing: 'border-box',
  },
  header: {
    background: 'transparent',
    padding: '20px 32px',
    animation: 'slideDown 0.4s ease-out both',
    flexShrink: 0,
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#1e5a8a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 10px rgba(30, 90, 138, 0.25)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8c9ab0',
    margin: 0,
    fontWeight: 400,
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b7a90',
    cursor: 'pointer',
    padding: 10,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px 50px',
    boxSizing: 'border-box',
  },
  centerContent: {
    textAlign: 'center',
    animation: 'fadeInUp 0.5s ease-out 0.15s both',
  },
  menuTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 8px',
    letterSpacing: '-0.02em',
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#8c9ab0',
    margin: '0 0 40px',
    fontWeight: 400,
  },
  cardsRow: {
    display: 'flex',
    gap: 16,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  card: {
    width: 146,
    padding: '28px 16px 24px',
    background: '#f6f9fc',
    border: '1.5px solid #e8ecf1',
    borderRadius: 16,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
    fontFamily: 'inherit',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    background: '#eaf0f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1a1a2e',
    lineHeight: 1.3,
    textAlign: 'center',
  },
};
