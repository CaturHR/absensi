import React from 'react';
import { Users, Clock, LogOut } from 'lucide-react';

const menuItems = [
  {
    id: 'users',
    label: 'Manajemen User',
    description: 'Tambah, edit, dan kelola data user/karyawan',
    icon: <Users size={28} className="text-[#1e5a8a]" />,
  },
  {
    id: 'attendance',
    label: 'Log Absensi',
    description: 'Melihat catatan log absensi Clock In & Clock Out',
    icon: <Clock size={28} className="text-[#1e5a8a]" />,
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
            title="Keluar dari akun admin"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7a90';
            }}
          >
            <LogOut size={18} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={styles.main}>
        <div style={styles.centerContent}>
          <h2 style={styles.menuTitle}>Dashboard Admin</h2>
          <p style={styles.menuSubtitle}>Silakan pilih menu manajemen yang ingin diakses</p>

          <div style={styles.cardsRow}>
            {menuItems.map((item) => (
              <button
                key={item.id}
                style={styles.card}
                onClick={() => onSelectMenu(item.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 16px 36px rgba(30, 90, 138, 0.16)';
                  e.currentTarget.style.borderColor = '#1e5a8a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.borderColor = '#e8ecf1';
                }}
              >
                <div style={styles.iconCircle}>
                  {item.icon}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={styles.cardLabel}>{item.label}</span>
                  <p style={styles.cardDesc}>{item.description}</p>
                </div>
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
    color: '#6b7a90',
    margin: 0,
    fontWeight: 400,
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: '#6b7a90',
    cursor: 'pointer',
    padding: '8px 14px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
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
    maxWidth: 680,
    width: '100%',
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
    color: '#6b7a90',
    margin: '0 0 36px',
    fontWeight: 400,
  },
  cardsRow: {
    display: 'flex',
    gap: 24,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  card: {
    flex: '1 1 240px',
    maxWidth: 290,
    padding: '36px 24px 30px',
    background: '#f6f9fc',
    border: '1.5px solid #e8ecf1',
    borderRadius: 20,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
    fontFamily: 'inherit',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: '#eaf0f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1a1a2e',
    lineHeight: 1.3,
    display: 'block',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: '#718096',
    margin: 0,
    lineHeight: 1.4,
  },
};
