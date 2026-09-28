import React, { useState } from 'react';
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Username dan password wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const user = data.data?.user;
        const token = data.data?.token;

        if (user?.role !== 'admin') {
          setError('Hanya akun Admin yang diizinkan mengakses dashboard ini.');
          setLoading(false);
          return;
        }

        // Simpan token dan data admin ke localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('admin_user', JSON.stringify(user));
        onLoginSuccess(user);
      } else {
        setError(data.message || 'Username atau password salah.');
      }
    } catch (err) {
      setError('Gagal terhubung ke server backend. Pastikan server berjalan di port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Logo & Branding */}
        <div style={styles.brandSection}>
          <div style={styles.logoCircle}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <h1 style={styles.companyName}>PT Poca Jaringan Solusi</h1>
          <p style={styles.subtitle}>Sistem Absensi Karyawan</p>
        </div>

        <div style={styles.divider} />

        {/* Login Header */}
        <div style={styles.loginHeader}>
          <h2 style={styles.loginTitle}>Masuk sebagai Admin</h2>
          <p style={styles.loginSubtitle}>Masukkan username dan password Anda.</p>
        </div>

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <AlertCircle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Username</label>
            <div style={styles.inputWrapper}>
              <div style={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin.poca"
                autoFocus
                style={styles.input}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1e5a8a';
                  e.target.style.boxShadow = '0 0 0 3px rgba(30, 90, 138, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <div style={styles.inputIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...styles.input, paddingRight: 44 }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#1e5a8a';
                  e.target.style.boxShadow = '0 0 0 3px rgba(30, 90, 138, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={styles.eyeBtn}
              >
                {showPwd ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>

          {/* Lupa Password */}
          <div style={styles.forgotRow}>
            <button type="button" style={styles.forgotLink}>Lupa password?</button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!loading) e.target.style.background = '#174d76';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#1e5a8a';
            }}
          >
            {loading ? (
              <>
                <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                <span>Memverifikasi...</span>
              </>
            ) : (
              <span>Masuk</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={styles.footer}>
          © 2026 PT Poca Jaringan Solusi · Hanya untuk admin
        </p>
      </div>

      {/* Spin animation for loader */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    boxSizing: 'border-box',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 4px 40px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
    padding: '40px 36px 32px',
    animation: 'fadeInUp 0.5s ease-out both',
  },
  brandSection: {
    textAlign: 'center',
    marginBottom: 0,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: '#1e5a8a',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    boxShadow: '0 4px 12px rgba(30, 90, 138, 0.25)',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 4px',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    fontSize: 13,
    color: '#8c9ab0',
    margin: 0,
    fontWeight: 400,
  },
  divider: {
    height: 1,
    background: '#e8ecf1',
    margin: '24px 0',
  },
  loginHeader: {
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: '0 0 6px',
  },
  loginSubtitle: {
    fontSize: 13.5,
    color: '#6b7a90',
    margin: 0,
    fontWeight: 400,
  },
  errorBox: {
    padding: '10px 14px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 12,
    color: '#dc2626',
    fontSize: 13,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#3d4f66',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    color: '#9ca3af',
  },
  input: {
    width: '100%',
    padding: '12px 16px 12px 44px',
    fontSize: 14,
    color: '#1a1a2e',
    background: '#f6f8fb',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
  },
  forgotRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: 20,
    marginTop: 2,
  },
  forgotLink: {
    background: 'none',
    border: 'none',
    color: '#1e5a8a',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    padding: 0,
    textDecoration: 'none',
  },
  submitBtn: {
    width: '100%',
    padding: '13px 24px',
    fontSize: 15,
    fontWeight: 600,
    color: '#ffffff',
    background: '#1e5a8a',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.2s ease',
    letterSpacing: '0.01em',
    boxShadow: '0 2px 8px rgba(30, 90, 138, 0.25)',
    fontFamily: 'inherit',
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#a0aab8',
    marginTop: 28,
    fontWeight: 400,
  },
};
