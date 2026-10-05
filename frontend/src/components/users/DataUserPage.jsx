import React, { useState, useEffect } from 'react';
import { fetchUsers, deleteUser, createUser, updateUser } from '../../services/api';
import { getImageUrl } from '../../utils/image';
import AddUserModal from './AddUserModal';
import UserPhotoModal from './UserPhotoModal';

export default function DataUserPage({ onBack, onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhotoUser, setSelectedPhotoUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  // Form state for inline edit modal
  const [editForm, setEditForm] = useState({ name: '', email: '', nip: '', password: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetchUsers();
      if (res && res.data) {
        // Filter hanya user (bukan admin)
        setUsers(res.data.filter(u => u.role !== 'admin'));
      } else {
        setUsers([]);
      }
    } catch (err) {
      setUsers([]);
      showNotif('error', 'Gagal memuat data user dari database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleUserCreated = (newUser) => {
    setUsers((prev) => [newUser, ...prev]);
    showNotif('success', `User "${newUser.name}" berhasil ditambahkan.`);
  };

  const handlePhotoUpdated = (updatedUser) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === updatedUser.id ? { ...u, face_photo: updatedUser.face_photo } : u))
    );
    showNotif('success', `Foto master wajah "${updatedUser.name}" berhasil diperbarui.`);
  };

  const handleDeleteUser = async (user) => {
    if (window.confirm(`Yakin ingin menghapus user "${user.name}"?`)) {
      try {
        await deleteUser(user.id);
        setUsers((prev) => prev.filter((u) => u.id !== user.id));
        showNotif('success', `User "${user.name}" telah dihapus.`);
      } catch (err) {
        showNotif('error', 'Gagal menghapus user: ' + err.message);
      }
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      nip: user.nip || '',
      divisi: user.divisi || user.department || '',
      password: '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      await updateUser(editingUser.id, {
        name: editForm.name,
        email: editForm.email,
        nip: editForm.nip,
        divisi: editForm.divisi,
        ...(editForm.password ? { password: editForm.password } : {}),
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? { ...u, name: editForm.name, email: editForm.email, nip: editForm.nip, divisi: editForm.divisi, department: editForm.divisi }
            : u
        )
      );
      showNotif('success', `Data "${editForm.name}" berhasil diperbarui.`);
      setShowEditModal(false);
      setEditingUser(null);
    } catch (err) {
      showNotif('error', 'Gagal memperbarui user: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  // Generate username from name (e.g. "Ahmad Fauzi" -> "ahmad.fauzi")
  const getUsername = (name) => {
    if (!name) return '-';
    return name.toLowerCase().replace(/\s+/g, '.');
  };

  return (
    <div style={styles.wrapper}>
      {/* Top Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <button onClick={onBack} style={styles.backBtn}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30,90,138,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div style={styles.headerLogo}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <path d="M9 22v-4h6v4" />
                <path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" />
                <path d="M12 10h.01" /><path d="M12 14h.01" />
                <path d="M16 10h.01" /><path d="M16 14h.01" />
                <path d="M8 10h.01" /><path d="M8 14h.01" />
              </svg>
            </div>
            <div>
              <h1 style={styles.headerTitle}>PT Poca Jaringan Solusi</h1>
              <p style={styles.headerSubtitle}>Sistem Absensi Karyawan</p>
            </div>
          </div>
          <button onClick={onLogout} style={styles.logoutBtn}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
        {/* Notification Toast */}
        {notification && (
          <div style={{
            ...styles.toast,
            background: notification.type === 'error' ? '#fef2f2' : '#f0fdf4',
            borderColor: notification.type === 'error' ? '#fecaca' : '#bbf7d0',
            color: notification.type === 'error' ? '#dc2626' : '#16a34a',
          }}>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} style={styles.toastClose}>✕</button>
          </div>
        )}

        {/* Page Title + Action */}
        <div style={styles.titleRow}>
          <div style={styles.titleLeft}>
            <div style={styles.titleIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <div>
              <h2 style={styles.pageTitle}>Data User</h2>
              <p style={styles.pageSubtitle}>Daftar akun karyawan yang terdaftar di sistem</p>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            style={styles.addBtn}
            onMouseEnter={(e) => e.currentTarget.style.background = '#174d76'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1e5a8a'}
          >
            + Tambah User
          </button>
        </div>

        {/* Data Table */}
        <div style={styles.tableCard}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={{ ...styles.th, width: 50 }}>NO</th>
                  <th style={{ ...styles.th, minWidth: 180 }}>NAMA</th>
                  <th style={{ ...styles.th, minWidth: 140 }}>USERNAME</th>
                  <th style={{ ...styles.th, minWidth: 130 }}>PASSWORD</th>
                  <th style={{ ...styles.th, minWidth: 120 }}>NIP</th>
                  <th style={{ ...styles.th, minWidth: 130 }}>DIVISI</th>
                  <th style={{ ...styles.th, width: 70, textAlign: 'center' }}>FOTO</th>
                  <th style={{ ...styles.th, width: 100, textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={styles.emptyCell}>
                      <div style={styles.spinner} />
                      <span style={{ color: '#8c9ab0', fontSize: 13 }}>Memuat data...</span>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={styles.emptyCell}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c4cdd8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                      <span style={{ color: '#8c9ab0', fontSize: 13, marginTop: 8 }}>Belum ada user terdaftar</span>
                    </td>
                  </tr>
                ) : (
                  users.map((user, index) => (
                    <tr key={user.id} style={styles.tableRow}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={styles.td}>{index + 1}</td>
                      <td style={{ ...styles.td, fontWeight: 600, color: '#1a1a2e' }}>{user.name}</td>
                      <td style={styles.td}>
                        <span style={styles.usernameBadge}>{getUsername(user.name)}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.passwordCell}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          <span style={{ letterSpacing: 2 }}>••••••••</span>
                        </span>
                      </td>
                      <td style={{ ...styles.td, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>
                        {user.nip || '-'}
                      </td>
                      <td style={{ ...styles.td, fontSize: 13 }}>
                        <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {user.divisi || user.department || '-'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoUser(user)}
                          style={styles.avatarButton}
                          title={`Klik untuk melihat & mengubah foto master "${user.name}"`}
                          aria-label={`Lihat dan ubah foto ${user.name}`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.08)';
                            e.currentTarget.style.borderColor = '#1e5a8a';
                            e.currentTarget.style.boxShadow = '0 3px 10px rgba(30, 90, 138, 0.25)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.borderColor = '#d1d5db';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          {user.face_photo ? (
                            <img
                              src={getImageUrl(user.face_photo)}
                              alt={user.name}
                              style={styles.avatarImg}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement.querySelector('.avatar-fallback');
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className="avatar-fallback"
                            style={{
                              ...styles.avatarFallback,
                              display: user.face_photo ? 'none' : 'flex',
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                          <div style={styles.avatarBadgeOverlay} title="Ubah Foto">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                              <circle cx="12" cy="13" r="4" />
                            </svg>
                          </div>
                        </button>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <div style={styles.actionCell}>
                          <button
                            onClick={() => handleEditUser(user)}
                            style={styles.editBtn}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#dbeafe'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#eff6ff'}
                            title="Edit User"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            style={styles.deleteBtn}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fef2f2'}
                            title="Hapus User"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add User Modal (existing) */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUserCreated={handleUserCreated}
      />

      {/* User Master Photo View & Edit Modal */}
      <UserPhotoModal
        isOpen={Boolean(selectedPhotoUser)}
        user={selectedPhotoUser}
        onClose={() => setSelectedPhotoUser(null)}
        onPhotoUpdated={handlePhotoUpdated}
      />

      {/* Edit User Modal */}
      {showEditModal && (
        <div style={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Edit User</h3>
              <button onClick={() => setShowEditModal(false)} style={styles.modalCloseBtn}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Nama Lengkap</label>
                <input
                  style={styles.modalInput}
                  value={editForm.name}
                  onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = '#1e5a8a'; e.target.style.boxShadow = '0 0 0 3px rgba(30,90,138,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Email</label>
                <input
                  style={styles.modalInput}
                  value={editForm.email}
                  onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = '#1e5a8a'; e.target.style.boxShadow = '0 0 0 3px rgba(30,90,138,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>NIP</label>
                <input
                  style={styles.modalInput}
                  value={editForm.nip}
                  onChange={(e) => setEditForm(f => ({ ...f, nip: e.target.value }))}
                  onFocus={(e) => { e.target.style.borderColor = '#1e5a8a'; e.target.style.boxShadow = '0 0 0 3px rgba(30,90,138,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Divisi</label>
                <input
                  style={styles.modalInput}
                  value={editForm.divisi}
                  onChange={(e) => setEditForm(f => ({ ...f, divisi: e.target.value }))}
                  placeholder="Contoh: Engineering, HR, Operasional"
                  onFocus={(e) => { e.target.style.borderColor = '#1e5a8a'; e.target.style.boxShadow = '0 0 0 3px rgba(30,90,138,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div style={styles.modalField}>
                <label style={styles.modalLabel}>Password Baru <span style={{ fontWeight: 400, color: '#9ca3af' }}>(kosongkan jika tidak diubah)</span></label>
                <input
                  type="password"
                  style={styles.modalInput}
                  value={editForm.password}
                  onChange={(e) => setEditForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  onFocus={(e) => { e.target.style.borderColor = '#1e5a8a'; e.target.style.boxShadow = '0 0 0 3px rgba(30,90,138,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setShowEditModal(false)} style={styles.modalCancelBtn}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={styles.modalSaveBtn}
                onMouseEnter={(e) => e.currentTarget.style.background = '#174d76'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#1e5a8a'}
              >
                {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    background: '#dce6f0',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  header: {
    background: 'transparent',
    padding: '20px 32px',
    animation: 'slideDown 0.4s ease-out both',
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
    gap: 12,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 8,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s ease',
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: '#1e5a8a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 3px 10px rgba(30, 90, 138, 0.25)',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#8c9ab0',
    margin: 0,
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
    padding: '0 32px 40px',
    maxWidth: 1200,
    margin: '0 auto',
    width: '100%',
    animation: 'fadeInUp 0.5s ease-out 0.1s both',
  },
  toast: {
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    animation: 'fadeInUp 0.3s ease-out both',
  },
  toastClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: 'inherit',
    opacity: 0.6,
    padding: '0 4px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16,
  },
  titleLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  titleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: '#eaf0f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#8c9ab0',
    margin: '2px 0 0',
    fontWeight: 400,
  },
  addBtn: {
    padding: '10px 22px',
    fontSize: 14,
    fontWeight: 600,
    color: '#ffffff',
    background: '#1e5a8a',
    border: '2px solid #1e5a8a',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(30, 90, 138, 0.2)',
  },
  tableCard: {
    background: '#ffffff',
    borderRadius: 16,
    border: '1px solid #e8ecf1',
    boxShadow: '0 2px 16px rgba(0, 0, 0, 0.04)',
    overflow: 'hidden',
  },
  tableScroll: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  tableHead: {
    background: '#f6f8fb',
    borderBottom: '1.5px solid #e8ecf1',
  },
  th: {
    padding: '14px 16px',
    fontSize: 11,
    fontWeight: 700,
    color: '#6b7a90',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  tableRow: {
    borderBottom: '1px solid #f0f2f5',
    transition: 'background 0.15s ease',
  },
  td: {
    padding: '16px 16px',
    fontSize: 13,
    color: '#4a5568',
    verticalAlign: 'middle',
  },
  usernameBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    background: '#eaf0f7',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    color: '#1e5a8a',
    fontFamily: "'IBM Plex Mono', monospace",
  },
  passwordCell: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#9ca3af',
    fontSize: 13,
  },
  avatarButton: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: '2px solid #cbd5e1',
    background: '#f1f5f9',
    padding: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#eaf0f7',
  },
  avatarBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 15,
    height: 15,
    borderRadius: '50%',
    background: '#1e5a8a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1.5px solid #ffffff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
  },
  actionCell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: '#eff6ff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: '#fef2f2',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
  },
  emptyCell: {
    padding: '48px 16px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  spinner: {
    width: 24,
    height: 24,
    border: '2.5px solid #e5e7eb',
    borderTopColor: '#1e5a8a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    marginBottom: 8,
  },

  // Edit Modal styles
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
    animation: 'fadeIn 0.2s ease-out both',
  },
  modalCard: {
    background: '#ffffff',
    borderRadius: 18,
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    animation: 'fadeInUp 0.3s ease-out both',
    overflow: 'hidden',
  },
  modalHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid #e8ecf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  modalCloseBtn: {
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
  },
  modalBody: {
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  modalField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#3d4f66',
  },
  modalInput: {
    padding: '10px 14px',
    fontSize: 14,
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    background: '#f6f8fb',
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
    color: '#1a1a2e',
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #e8ecf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#4a5568',
    background: '#f8fafc',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  },
  modalSaveBtn: {
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#ffffff',
    background: '#1e5a8a',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    boxShadow: '0 2px 6px rgba(30, 90, 138, 0.2)',
  },
};
