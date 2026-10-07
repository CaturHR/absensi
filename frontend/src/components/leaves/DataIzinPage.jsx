import React, { useState, useEffect } from 'react';
import { fetchLeaveRequests, approveLeave, rejectLeave } from '../../services/api';
import { getImageUrl } from '../../utils/image';

export default function DataIzinPage({ onBack, onLogout }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [selectedFileModal, setSelectedFileModal] = useState(null);
  const [imageError, setImageError] = useState(false);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetchLeaveRequests();
      if (res && res.data) {
        setLeaves(res.data);
      } else {
        setLeaves([]);
      }
    } catch (err) {
      setLeaves([]);
      showNotif('error', 'Gagal memuat data izin dari database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();

    const handleRealtimeLeave = (e) => {
      const data = e.detail;
      console.log('[DataIzinPage] Permohonan izin real-time diterima, memperbarui data...', data);
      loadLeaves();
      if (data?.userName) {
        showNotif('info', `Permohonan izin baru dari ${data.userName}: ${data.reason || ''}`);
      }
    };

    window.addEventListener('app:leave-request', handleRealtimeLeave);
    return () => {
      window.removeEventListener('app:leave-request', handleRealtimeLeave);
    };
  }, []);

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handleApprovalChange = async (leaveId, newStatus) => {
    const targetLeave = leaves.find((l) => l.id === leaveId);
    const employeeName = targetLeave ? (targetLeave.user_name || targetLeave.name || 'Karyawan') : 'Karyawan';

    // Update UI immediately (optimistic)
    setLeaves((prev) =>
      prev.map((l) => (l.id === leaveId ? { ...l, status: newStatus } : l))
    );

    if (selectedFileModal && selectedFileModal.id === leaveId) {
      setSelectedFileModal((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    if (newStatus === 'approved') {
      try {
        const res = await approveLeave(leaveId);
        if (res.success) {
          showNotif('success', `Izin untuk ${employeeName} telah disetujui.`);
        } else {
          showNotif('info', `Status izin ${employeeName} diperbarui: Disetujui.`);
        }
      } catch (err) {
        showNotif('info', `Status izin ${employeeName} diperbarui: Disetujui.`);
      }
    } else if (newStatus === 'rejected') {
      try {
        const res = await rejectLeave(leaveId);
        if (res.success) {
          showNotif('success', `Izin untuk ${employeeName} telah ditolak.`);
        } else {
          showNotif('info', `Status izin ${employeeName} diperbarui: Ditolak.`);
        }
      } catch (err) {
        showNotif('info', `Status izin ${employeeName} diperbarui: Ditolak.`);
      }
    } else {
      showNotif('info', `Status izin ${employeeName} diatur ke pending.`);
    }
  };

  const getSelectStyle = (status) => {
    if (status === 'approved') {
      return {
        background: '#eaf7ec',
        borderColor: '#86efac',
        color: '#166534',
        fontWeight: 600,
      };
    }
    if (status === 'rejected') {
      return {
        background: '#fde8e8',
        borderColor: '#fca5a5',
        color: '#991b1b',
        fontWeight: 600,
      };
    }
    // Default 'pending' / 'Pilih tindakan'
    return {
      background: '#ffffff',
      borderColor: '#cbd5e1',
      color: '#475569',
      fontWeight: 500,
    };
  };

  // Helper untuk mengenali tipe attachment (gambar, pdf, atau dokumen lain)
  const isImageFile = (path) => {
    if (!path) return false;
    return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(path) || path.startsWith('data:image/') || path.startsWith('blob:');
  };

  const isPdfFile = (path) => {
    if (!path) return false;
    return /\.pdf$/i.test(path);
  };

  const openModal = (item) => {
    setImageError(false);
    setSelectedFileModal(item);
  };

  return (
    <div style={styles.wrapper}>
      {/* Top Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            <button
              onClick={onBack}
              style={styles.backBtn}
              title="Kembali ke Menu"
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30,90,138,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
          <button
            onClick={onLogout}
            style={styles.logoutBtn}
            title="Keluar"
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={styles.main}>
        {/* Toast Notification */}
        {notification && (
          <div
            style={{
              ...styles.toast,
              background: notification.type === 'error' ? '#fef2f2' : notification.type === 'success' ? '#f0fdf4' : '#eff6ff',
              borderColor: notification.type === 'error' ? '#fecaca' : notification.type === 'success' ? '#bbf7d0' : '#bfdbfe',
              color: notification.type === 'error' ? '#dc2626' : notification.type === 'success' ? '#16a34a' : '#1d4ed8',
            }}
          >
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} style={styles.toastClose}>✕</button>
          </div>
        )}

        {/* Page Title Row */}
        <div style={styles.titleRow}>
          <div style={styles.titleLeft}>
            <div style={styles.titleIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 7L2 7" />
              </svg>
            </div>
            <div>
              <h2 style={styles.pageTitle}>Data Izin Karyawan</h2>
              <p style={styles.pageSubtitle}>Daftar pengajuan izin dan peninjauan berkas lampiran</p>
            </div>
          </div>
        </div>

        {/* Data Table Card */}
        <div style={styles.tableCard}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={{ ...styles.th, width: 60, textAlign: 'center' }}>NO</th>
                  <th style={{ ...styles.th, minWidth: 170 }}>NAMA</th>
                  <th style={{ ...styles.th, minWidth: 240 }}>ALASAN & KETERANGAN</th>
                  <th style={{ ...styles.th, minWidth: 150, textAlign: 'center' }}>SURAT / LAMPIRAN</th>
                  <th style={{ ...styles.th, minWidth: 150 }}>APPROVAL</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={styles.emptyCell}>
                      <div style={styles.spinner} />
                      <span style={{ color: '#8c9ab0', fontSize: 13, marginTop: 8 }}>Memuat data pengajuan izin...</span>
                    </td>
                  </tr>
                ) : leaves.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={styles.emptyCell}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c4cdd8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M22 7l-10 7L2 7" />
                      </svg>
                      <span style={{ color: '#8c9ab0', fontSize: 13, marginTop: 8 }}>Tidak ada data pengajuan izin</span>
                    </td>
                  </tr>
                ) : (
                  leaves.map((item, index) => {
                    const selectStyle = getSelectStyle(item.status);
                    const clockIn = item.clock_in;
                    const clockOut = item.clock_out;
                    const hasAttachment = Boolean(item.attachment);

                    return (
                      <tr
                        key={item.id || index}
                        style={styles.tableRow}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* NO */}
                        <td style={{ ...styles.td, textAlign: 'center', color: '#64748b' }}>
                          {index + 1}
                        </td>

                        {/* NAMA */}
                        <td style={{ ...styles.td, fontWeight: 700, color: '#1a1a2e', fontSize: 14 }}>
                          <div>{item.user_name || item.name || 'Nama Karyawan'}</div>
                          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 400 }}>
                            {item.user_nip ? `NIP: ${item.user_nip}` : item.user_email || ''}
                          </div>
                        </td>

                        {/* ALASAN */}
                        <td style={{ ...styles.td, color: '#334155', fontSize: 13.5 }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.reason || '-'}</div>
                          {item.description && (
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>
                              "{item.description}"
                            </div>
                          )}
                        </td>

                        {/* SURAT IZIN / ATTACHMENT */}
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button
                            onClick={() => openModal(item)}
                            style={{
                              ...styles.fileBtn,
                              background: hasAttachment ? '#eff6ff' : '#f8fafc',
                              borderColor: hasAttachment ? '#bfdbfe' : '#e2e8f0',
                              color: hasAttachment ? '#1d4ed8' : '#475569',
                            }}
                            title={hasAttachment ? 'Klik untuk melihat lampiran berkas' : 'Klik untuk melihat rincian surat izin'}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = hasAttachment ? '#dbeafe' : '#f1f5f9';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = hasAttachment ? '#eff6ff' : '#f8fafc';
                            }}
                          >
                            {hasAttachment ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                </svg>
                                <span style={{ fontWeight: 600 }}>Lihat Berkas</span>
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                <span>Lihat Detail</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* APPROVAL */}
                        <td style={styles.td}>
                          <div style={styles.selectWrapper}>
                            <select
                              value={item.status || 'pending'}
                              onChange={(e) => handleApprovalChange(item.id, e.target.value)}
                              style={{
                                ...styles.select,
                                ...selectStyle,
                              }}
                            >
                              <option value="approved" style={styles.optionApproved}>Setujui</option>
                              <option value="rejected" style={styles.optionRejected}>Ditolak</option>
                            </select>
                            <svg
                              style={styles.selectArrow}
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={selectStyle.color}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Preview Lampiran Surat Izin */}
      {selectedFileModal && (
        <div style={styles.modalOverlay} onClick={() => setSelectedFileModal(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={styles.modalHeaderIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Pratinjau Dokumen Izin</h3>
                  <p style={styles.modalSubtitle}>
                    {selectedFileModal.user_name || 'Karyawan'} • NIP: {selectedFileModal.user_nip || '-'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFileModal(null)}
                style={styles.modalCloseBtn}
                title="Tutup"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={styles.modalBody}>
              {/* Status Header Bar */}
              <div style={styles.statusHeaderBar}>
                <div>
                  <span style={styles.docLabel}>Alasan Pengajuan:</span>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#1e5a8a', marginTop: 2 }}>
                    {selectedFileModal.reason}
                  </div>
                </div>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      background:
                        selectedFileModal.status === 'approved'
                          ? '#dcfce7'
                          : selectedFileModal.status === 'rejected'
                          ? '#fee2e2'
                          : '#fef3c7',
                      color:
                        selectedFileModal.status === 'approved'
                          ? '#15803d'
                          : selectedFileModal.status === 'rejected'
                          ? '#b91c1c'
                          : '#b45309',
                    }}
                  >
                    {selectedFileModal.status === 'approved'
                      ? '✓ Disetujui'
                      : selectedFileModal.status === 'rejected'
                      ? '✕ Ditolak'
                      : '⏳ Menunggu Persetujuan'}
                  </span>
                </div>
              </div>

              {/* Keterangan Detail Box */}
              {selectedFileModal.description && (
                <div style={styles.descContainer}>
                  <span style={styles.docLabel}>Keterangan Karyawan:</span>
                  <p style={styles.descText}>{selectedFileModal.description}</p>
                </div>
              )}

              {/* Lampiran Berkas Section */}
              <div style={styles.attachmentSection}>
                <div style={styles.attachmentSectionHeader}>
                  <span style={styles.sectionHeaderTitle}>
                    📎 Berkas Lampiran (Surat Dokter / Bukti)
                  </span>
                  {selectedFileModal.attachment && (
                    <a
                      href={getImageUrl(selectedFileModal.attachment)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.openExternalLink}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                      <span>Buka Tab Baru</span>
                    </a>
                  )}
                </div>

                {selectedFileModal.attachment ? (
                  isImageFile(selectedFileModal.attachment) ? (
                    /* Pratinjau Gambar / Foto Bukti */
                    <div style={styles.imageViewerContainer}>
                      {!imageError ? (
                        <img
                          src={getImageUrl(selectedFileModal.attachment)}
                          alt="Lampiran Surat Izin"
                          style={styles.previewImage}
                          onError={() => setImageError(true)}
                        />
                      ) : (
                        <div style={styles.imageErrorBox}>
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 13 }}>
                            Gagal memuat gambar atau file tidak ditemukan di server.
                          </p>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{selectedFileModal.attachment}</span>
                        </div>
                      )}
                    </div>
                  ) : isPdfFile(selectedFileModal.attachment) ? (
                    /* Pratinjau PDF */
                    <div style={styles.pdfViewerContainer}>
                      <iframe
                        src={getImageUrl(selectedFileModal.attachment)}
                        title="Pratinjau PDF"
                        style={styles.pdfIframe}
                      />
                    </div>
                  ) : (
                    /* Dokumen Lain */
                    <div style={styles.genericFileBox}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                          {selectedFileModal.attachment.split('/').pop()}
                        </div>
                        <a
                          href={getImageUrl(selectedFileModal.attachment)}
                          download
                          style={styles.downloadFileBtn}
                        >
                          Unduh Dokumen
                        </a>
                      </div>
                    </div>
                  )
                ) : (
                  /* Tidak Ada Lampiran */
                  <div style={styles.noAttachmentBox}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                    <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
                      Tidak ada file lampiran fisik yang diunggah oleh karyawan.
                    </p>
                    <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                      Permohonan diajukan dengan keterangan tertulis.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer dengan Quick Actions Approval */}
            <div style={styles.modalFooter}>
              <div style={styles.quickApprovalGroup}>
                <button
                  onClick={() => handleApprovalChange(selectedFileModal.id, 'approved')}
                  disabled={selectedFileModal.status === 'approved'}
                  style={{
                    ...styles.actionApproveBtn,
                    opacity: selectedFileModal.status === 'approved' ? 0.6 : 1,
                  }}
                >
                  ✓ Setujui Izin
                </button>
                <button
                  onClick={() => handleApprovalChange(selectedFileModal.id, 'rejected')}
                  disabled={selectedFileModal.status === 'rejected'}
                  style={{
                    ...styles.actionRejectBtn,
                    opacity: selectedFileModal.status === 'rejected' ? 0.6 : 1,
                  }}
                >
                  ✕ Tolak Izin
                </button>
              </div>

              <button
                onClick={() => setSelectedFileModal(null)}
                style={styles.modalCloseMainBtn}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Animation Keyframes */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
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
    justifyContent: 'center',
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
    lineHeight: 1.2,
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
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  pageSubtitle: {
    fontSize: 13,
    color: '#8c9ab0',
    margin: '3px 0 0',
    fontWeight: 400,
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
    background: '#f8fafc',
    borderBottom: '1.5px solid #edf2f7',
  },
  th: {
    padding: '16px 18px',
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  tableRow: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.15s ease',
  },
  td: {
    padding: '18px 18px',
    fontSize: 13.5,
    verticalAlign: 'middle',
  },
  fileBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 20,
    border: '1px solid',
    fontSize: 12,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
  },
  clockContainer: {
    fontSize: 12.5,
    lineHeight: 1.5,
    fontFamily: "'DM Sans', sans-serif",
  },
  selectWrapper: {
    position: 'relative',
    display: 'inline-block',
    width: '100%',
    maxWidth: 140,
  },
  select: {
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    padding: '6px 28px 6px 12px',
    borderRadius: 8,
    border: '1.5px solid',
    fontSize: 12.5,
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.18s ease',
    fontFamily: 'inherit',
  },
  selectArrow: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  optionPending: {
    background: '#ffffff',
    color: '#475569',
    fontWeight: 'normal',
  },
  optionApproved: {
    background: '#ffffff',
    color: '#166534',
    fontWeight: 'bold',
  },
  optionRejected: {
    background: '#ffffff',
    color: '#991b1b',
    fontWeight: 'bold',
  },
  emptyCell: {
    padding: '48px 20px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid #e2e8f0',
    borderTopColor: '#1e5a8a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
    animation: 'fadeIn 0.2s ease-out',
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: 18,
    width: '100%',
    maxWidth: 620,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.2)',
    overflow: 'hidden',
    animation: 'fadeInUp 0.25s ease-out',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #f1f5f9',
    background: '#ffffff',
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: '#eaf0f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    margin: '2px 0 0',
  },
  modalCloseBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 16,
    color: '#94a3b8',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 6,
    transition: 'color 0.15s ease',
  },
  modalBody: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  statusHeaderBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#f8fafc',
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    marginBottom: 14,
  },
  docLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  descContainer: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 16,
  },
  descText: {
    fontSize: 13,
    color: '#334155',
    margin: '4px 0 0',
    lineHeight: 1.5,
  },
  attachmentSection: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '16px',
  },
  attachmentSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#334155',
  },
  openExternalLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11.5,
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'none',
    background: '#eff6ff',
    padding: '4px 8px',
    borderRadius: 6,
  },
  imageViewerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 220,
    maxHeight: 380,
  },
  previewImage: {
    maxWidth: '100%',
    maxHeight: 380,
    objectFit: 'contain',
    display: 'block',
  },
  imageErrorBox: {
    padding: '30px 20px',
    textAlign: 'center',
    background: '#f1f5f9',
    width: '100%',
  },
  pdfViewerContainer: {
    width: '100%',
    height: 380,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #cbd5e1',
  },
  pdfIframe: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  genericFileBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px',
    background: '#ffffff',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
  },
  downloadFileBtn: {
    display: 'inline-block',
    marginTop: 4,
    fontSize: 12,
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'underline',
  },
  noAttachmentBox: {
    padding: '24px 16px',
    textAlign: 'center',
    background: '#ffffff',
    borderRadius: 10,
    border: '1px dashed #cbd5e1',
  },
  modalFooter: {
    padding: '14px 24px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#f8fafc',
    gap: 12,
    flexWrap: 'wrap',
  },
  quickApprovalGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  actionApproveBtn: {
    padding: '7px 14px',
    background: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  actionRejectBtn: {
    padding: '7px 14px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modalCloseMainBtn: {
    padding: '7px 16px',
    background: '#e2e8f0',
    color: '#334155',
    border: 'none',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
