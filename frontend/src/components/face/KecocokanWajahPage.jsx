import React, { useState, useEffect } from 'react';
import { fetchAttendanceLogs, updateAttendanceStatus } from '../../services/api';
import { getImageUrl } from '../../utils/imageUrl';

export default function KecocokanWajahPage({ onBack, onLogout }) {
  const [faceLogs, setFaceLogs] = useState([]);
  const [filterTab, setFilterTab] = useState('failed'); // 'failed' (Perlu Review) | 'all' (Semua Riwayat Log)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'approved' | 'rejected'
  const [pageSize, setPageSize] = useState('10'); // '10' | '15' | '50' | '100' | '200' | '500' | 'all'
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [selectedPhotoModal, setSelectedPhotoModal] = useState(null);

  const isApproved = (status) => {
    if (!status) return false;
    const s = status.toLowerCase().trim();
    return s === 'hadir' || s === 'match' || s === 'clock in' || s === 'disetujui';
  };

  const isRejected = (status) => {
    if (!status) return false;
    const s = status.toLowerCase().trim();
    return (
      s === 'wajah tidak cocok' ||
      s === 'mismatch' ||
      s === 'gagal verifikasi wajah' ||
      s === 'ditolak'
    );
  };

  // Hanya data not match yang belum direview yang tampil di tab "Perlu Review"
  // Data yang sudah berstatus disetujui atau ditolak tidak akan ada di "Perlu Review"
  const isPendingReview = (item) => {
    if (!item) return false;
    const s = (item.status || '').toLowerCase().trim();

    // Data yang sudah berstatus disetujui -> TIDAK ADA di Perlu Review
    if (isApproved(item.status)) {
      return false;
    }

    // Data yang sudah berstatus ditolak -> TIDAK ADA di Perlu Review
    if (isRejected(item.status)) {
      return false;
    }

    // Status absensi non-review (clock out normal, izin, di luar radius) -> TIDAK ADA di Perlu Review
    if (s === 'clock out' || s === 'izin' || s === 'di luar radius') {
      return false;
    }

    // Sisanya adalah data not match yang belum direview (status 'pending', '', null, 'menunggu review', dll)
    return true;
  };

  const loadFaceLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchAttendanceLogs({ limit: 1000 });
      if (res && res.data) {
        setFaceLogs(res.data);
      } else {
        setFaceLogs([]);
      }
    } catch (err) {
      setFaceLogs([]);
      showNotif('error', 'Gagal memuat log verifikasi wajah dari database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaceLogs();
  }, []);

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3500);
  };

  const handlePageSizeChange = (val) => {
    setPageSize(val);
    setCurrentPage(1);
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
    if (val === 'pending') {
      setFilterTab('failed');
    } else if (val === 'approved' || val === 'rejected') {
      setFilterTab('all');
    }
  };

  const handleTabChange = (tab) => {
    setFilterTab(tab);
    setStatusFilter('all');
    setCurrentPage(1);
  };

  const handleApprovalChange = async (id, newStatus) => {
    const target = faceLogs.find((l) => l.id === id);
    const name = target ? (target.user_name || 'Karyawan') : 'Karyawan';

    // Normalize status
    const dbStatus =
      newStatus === 'match' || newStatus === 'Hadir' || newStatus === 'Clock In'
        ? 'Clock In'
        : newStatus === 'mismatch' || newStatus === 'Wajah Tidak Cocok'
        ? 'Wajah Tidak Cocok'
        : newStatus === 'pending' || newStatus === 'Menunggu Review'
        ? 'pending'
        : newStatus;

    // Simpan state sebelumnya untuk rollback jika API gagal
    const prevLogs = [...faceLogs];

    // Update state lokal secara optimistic agar UI responsif
    setFaceLogs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: dbStatus } : item))
    );

    try {
      await updateAttendanceStatus(id, dbStatus, `Manual approval oleh admin (${dbStatus})`);

      // Reload data dari server untuk memastikan konsistensi saat kembali ke halaman
      const res = await fetchAttendanceLogs({ limit: 1000 });
      if (res && res.data) {
        setFaceLogs(res.data);
      }

      if (dbStatus === 'Clock In') {
        showNotif('success', `Absensi ${name} telah disetujui (Clock In pada jam saat presensi dilakukan di tanggal yang sama).`);
      } else if (dbStatus === 'Wajah Tidak Cocok') {
        showNotif('error', `Absensi ${name} ditolak (Terhitung Alpha & tidak masuk ke log absen).`);
      } else {
        showNotif('info', `Status absensi ${name} diatur ke: Menunggu Review.`);
      }
    } catch (err) {
      // Rollback state lokal jika API gagal
      setFaceLogs(prevLogs);
      console.error('Error updating status:', err);
      showNotif('error', `Gagal menyimpan perubahan status ${name}: ${err.message}`);
    }
  };

  const getSelectStyle = (status) => {
    if (isApproved(status)) {
      return {
        background: '#eaf7ec',
        borderColor: '#86efac',
        color: '#166534',
        fontWeight: 600,
      };
    }
    if (isRejected(status)) {
      return {
        background: '#fde8e8',
        borderColor: '#fca5a5',
        color: '#991b1b',
        fontWeight: 600,
      };
    }
    // Default 'pending' / 'Menunggu Review'
    return {
      background: '#ffffff',
      borderColor: '#cbd5e1',
      color: '#475569',
      fontWeight: 500,
    };
  };

  const pendingCount = faceLogs.filter((item) => isPendingReview(item)).length;

  // Filter dipisah secara tegas: Tab "Perlu Review" vs Tab "Semua Riwayat Log"
  const displayedLogs = faceLogs.filter((item) => {
    // 1. Pemisahan Tab
    if (filterTab === 'failed') {
      // Tab Perlu Review: HANYA data not match yang belum direview
      if (!isPendingReview(item)) return false;
    } else {
      // Tab Semua Riwayat Log: Tampilkan seluruh log dengan opsi filter status
      if (statusFilter === 'pending') {
        if (!isPendingReview(item)) return false;
      } else if (statusFilter === 'approved') {
        if (!isApproved(item.status)) return false;
      } else if (statusFilter === 'rejected') {
        if (!isRejected(item.status)) return false;
      }
    }

    // 2. Pencarian (Nama, Username/Email, NIP, Status)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const name = (item.user_name || '').toLowerCase();
      const email = (item.user_email || item.email || '').toLowerCase();
      const username = (item.username || '').toLowerCase();
      const nip = (item.user_nip || '').toLowerCase();

      // Cocokkan teks nama, email, username, NIP
      const matchText =
        name.includes(q) ||
        email.includes(q) ||
        username.includes(q) ||
        nip.includes(q);

      // Cocokkan status (disetujui, ditolak, pending) jika user mengetik kata kunci status
      const matchStatus =
        (q === 'pending' || q.includes('menunggu') || q.includes('review')) && isPendingReview(item) ||
        (q.includes('setuju') || q.includes('disetujui') || q === 'hadir' || q.includes('clock in')) && isApproved(item.status) ||
        (q.includes('tolak') || q.includes('ditolak') || q.includes('tidak cocok')) && isRejected(item.status);

      if (!matchText && !matchStatus) {
        return false;
      }
    }

    return true;
  });

  // Logika Pagination & Limit (10, 15, 50, 100, 200, 500, all)
  const isAll = pageSize === 'all';
  const limit = isAll ? displayedLogs.length : parseInt(pageSize, 10);
  const totalPages = isAll ? 1 : Math.max(1, Math.ceil(displayedLogs.length / (limit || 1)));
  const validPage = Math.min(Math.max(currentPage, 1), totalPages);

  const startIndex = isAll ? (displayedLogs.length > 0 ? 1 : 0) : displayedLogs.length === 0 ? 0 : (validPage - 1) * limit + 1;
  const endIndex = isAll ? displayedLogs.length : Math.min(validPage * limit, displayedLogs.length);

  const paginatedLogs = isAll
    ? displayedLogs
    : displayedLogs.slice((validPage - 1) * limit, validPage * limit);

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
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <path d="M9 9h.01" />
                <path d="M15 9h.01" />
                <path d="M10 13a3.5 3.5 0 0 0 4 0" />
              </svg>
            </div>
            <div>
              <h2 style={styles.pageTitle}>Approval Not Match</h2>
              <p style={styles.pageSubtitle}>
                {searchQuery.trim() || (filterTab === 'all' && statusFilter !== 'all')
                  ? `Ditemukan ${displayedLogs.length} dari ${faceLogs.length} data absensi`
                  : filterTab === 'failed'
                  ? `Menampilkan ${displayedLogs.length} data absensi yang memerlukan review manual admin`
                  : `Daftar seluruh riwayat log absensi karyawan (${faceLogs.length} total)`}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar: Limit, Search, Status Filter & Tabs */}
        <div style={styles.toolbar}>
          {/* Limit Selector */}
          <div style={styles.limitBox}>
            <span style={styles.limitLabel}>Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(e.target.value)}
              style={styles.limitSelect}
              aria-label="Pilih jumlah data per halaman"
            >
              <option value="10">10 data</option>
              <option value="15">15 data</option>
              <option value="50">50 data</option>
              <option value="100">100 data</option>
              <option value="200">200 data</option>
              <option value="500">500 data</option>
              <option value="all">Semua (All)</option>
            </select>
          </div>

          {/* Search Box */}
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Cari nama, email, status..."
              style={styles.searchInput}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#1e5a8a';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(30, 90, 138, 0.12)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#d1d9e6';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                style={styles.clearSearchBtn}
                title="Hapus pencarian"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Dropdown (Tampil khusus saat di tab Semua Riwayat Log) */}
          {filterTab === 'all' && (
            <div style={styles.statusFilterBox}>
              <span style={styles.statusFilterLabel}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                style={styles.statusFilterSelect}
              >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu Review (Pending)</option>
                <option value="approved">Disetujui (Clock In)</option>
                <option value="rejected">Ditolak (Wajah Tidak Cocok)</option>
              </select>
            </div>
          )}

          {/* Filter Tabs (Perlu Review dipisah tegas dari Semua Riwayat Log) */}
          <div style={styles.tabsWrapper}>
            <button
              onClick={() => handleTabChange('failed')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: filterTab === 'failed' ? '1.5px solid #1e5a8a' : '1px solid #cbd5e1',
                background: filterTab === 'failed' ? '#eff6ff' : '#ffffff',
                color: filterTab === 'failed' ? '#1e5a8a' : '#64748b',
                fontWeight: filterTab === 'failed' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <span>Perlu Review</span>
              {pendingCount > 0 && (
                <span style={{
                  background: '#ef4444',
                  color: 'white',
                  borderRadius: 12,
                  padding: '2px 7px',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleTabChange('all')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: filterTab === 'all' ? '1.5px solid #1e5a8a' : '1px solid #cbd5e1',
                background: filterTab === 'all' ? '#eff6ff' : '#ffffff',
                color: filterTab === 'all' ? '#1e5a8a' : '#64748b',
                fontWeight: filterTab === 'all' ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Semua Riwayat Log ({faceLogs.length})
            </button>
          </div>
        </div>

        {/* Data Table Card */}
        <div style={styles.tableCard}>
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHead}>
                  <th style={{ ...styles.th, width: 60, textAlign: 'center' }}>NO</th>
                  <th style={{ ...styles.th, minWidth: 200 }}>NAMA</th>
                  <th style={{ ...styles.th, minWidth: 180 }}>USERNAME</th>
                  <th style={{ ...styles.th, minWidth: 100, textAlign: 'center' }}>FOTO</th>
                  <th style={{ ...styles.th, minWidth: 160 }}>APPROVAL</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={styles.emptyCell}>
                      <div style={styles.spinner} />
                      <span style={{ color: '#8c9ab0', fontSize: 13, marginTop: 8 }}>Memuat data verifikasi wajah...</span>
                    </td>
                  </tr>
                ) : paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={styles.emptyCell}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c4cdd8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                      </svg>
                      <span style={{ color: '#8c9ab0', fontSize: 13, marginTop: 8 }}>
                        {searchQuery.trim() || statusFilter !== 'all'
                          ? `Tidak ada data yang sesuai dengan filter pencarian.`
                          : filterTab === 'failed'
                          ? 'Tidak ada data not match yang perlu review.'
                          : 'Belum ada log verifikasi wajah.'}
                      </span>
                      {(searchQuery.trim() || statusFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('all');
                            setCurrentPage(1);
                          }}
                          style={{
                            marginTop: 10,
                            padding: '6px 14px',
                            background: '#eff6ff',
                            color: '#1e5a8a',
                            border: '1px solid #bfdbfe',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Reset Pencarian & Filter
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((item, index) => {
                    const selectStyle = getSelectStyle(item.status);
                    const rowNumber = isAll ? index + 1 : (validPage - 1) * limit + index + 1;

                    return (
                      <tr
                        key={item.id || `${item.user_id}-${index}`}
                        style={styles.tableRow}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* NO */}
                        <td style={{ ...styles.td, textAlign: 'center', color: '#64748b' }}>
                          {rowNumber}
                        </td>

                        {/* NAMA */}
                        <td style={{ ...styles.td, fontWeight: 700, color: '#1a1a2e', fontSize: 14 }}>
                          {item.user_name}
                        </td>

                        {/* USERNAME */}
                        <td style={styles.td}>
                          <span style={styles.usernameBadge}>
                            {item.user_email || item.email || item.username || item.user_name}
                          </span>
                        </td>

                        {/* FOTO */}
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button
                            onClick={() => setSelectedPhotoModal(item)}
                            style={styles.photoBtn}
                            title="Klik untuk membandingkan foto master vs absen"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#dbeafe';
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#eaf2fd';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </button>
                        </td>

                        {/* APPROVAL */}
                        <td style={styles.td}>
                          <div style={styles.selectWrapper}>
                            <select
                              value={
                                isApproved(item.status)
                                  ? 'Clock In'
                                  : isRejected(item.status)
                                  ? 'Wajah Tidak Cocok'
                                  : 'pending'
                              }
                              onChange={(e) => handleApprovalChange(item.id, e.target.value)}
                              style={{
                                ...styles.select,
                                ...selectStyle,
                              }}
                            >
                              <option value="pending" style={styles.optionPending}>Menunggu Review</option>
                              <option value="Clock In" style={styles.optionMatch}>✓ Disetujui (Clock In)</option>
                              <option value="Wajah Tidak Cocok" style={styles.optionMismatch}>✕ Ditolak (Wajah Tidak Cocok)</option>
                            </select>
                            {/* Chevron icon */}
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

          {/* Table Footer: Info Jumlah Data & Pagination Controls */}
          <div style={styles.tableFooter}>
            <div style={styles.footerInfo}>
              Menampilkan <span style={{ fontWeight: 600, color: '#1e293b' }}>{displayedLogs.length === 0 ? 0 : `${startIndex} - ${endIndex}`}</span> dari <span style={{ fontWeight: 600, color: '#1e293b' }}>{displayedLogs.length}</span> data {filterTab === 'failed' ? '(Perlu Review)' : '(Semua Riwayat)'}
              {faceLogs.length !== displayedLogs.length && ` • Total keseluruhan: ${faceLogs.length} log`}
            </div>

            {!isAll && totalPages > 1 && (
              <div style={styles.paginationControls}>
                <button
                  type="button"
                  disabled={validPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  style={{
                    ...styles.pageBtn,
                    opacity: validPage <= 1 ? 0.45 : 1,
                    cursor: validPage <= 1 ? 'not-allowed' : 'pointer',
                  }}
                  title="Halaman Sebelumnya"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Prev</span>
                </button>

                <div style={styles.pageIndicator}>
                  Halaman <strong style={{ color: '#1e5a8a' }}>{validPage}</strong> dari <strong>{totalPages}</strong>
                </div>

                <button
                  type="button"
                  disabled={validPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  style={{
                    ...styles.pageBtn,
                    opacity: validPage >= totalPages ? 0.45 : 1,
                    cursor: validPage >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                  title="Halaman Selanjutnya"
                >
                  <span>Next</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Perbandingan Foto Wajah (Master vs Absen) */}
      {selectedPhotoModal && (
        <div style={styles.modalOverlay} onClick={() => setSelectedPhotoModal(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={styles.modalHeaderIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  </svg>
                </div>
                <div>
                  <h3 style={styles.modalTitle}>Verifikasi Manual Kecocokan Wajah</h3>
                  <p style={styles.modalSubtitle}>{selectedPhotoModal.user_name} ({selectedPhotoModal.user_email || selectedPhotoModal.email || selectedPhotoModal.user_nip || 'Karyawan'})</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                style={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Info Banner Manual Approval */}
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 12.5,
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>Bandingkan foto master pendaftaran dengan foto selfie saat absen. Jika disetujui, absensi akan otomatis berstatus Clock In pada jam saat presensi dilakukan dari mobile di tanggal yang sama. Jika ditolak, absensi terhitung Alpha dan tidak masuk ke log absen.</span>
              </div>

              {/* Dua Kolom Foto Komparasi */}
              <div style={styles.compareGrid}>
                {/* Foto Master */}
                <div style={styles.photoCard}>
                  <div style={styles.photoBadgeMaster}>Foto Master (Pendaftaran)</div>
                  <div style={styles.photoContainer}>
                    {selectedPhotoModal.master_photo ? (
                      <img
                        src={getImageUrl(selectedPhotoModal.master_photo)}
                        alt="Foto Master"
                        style={styles.compareImg}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      display: selectedPhotoModal.master_photo ? 'none' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      background: '#f1f5f9',
                      color: '#64748b',
                      fontSize: 12,
                      padding: 16,
                      textAlign: 'center',
                    }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                        <circle cx="12" cy="7" r="4" />
                        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                      </svg>
                      <span style={{ marginTop: 6 }}>Belum ada foto master</span>
                    </div>
                  </div>
                  <div style={styles.photoCaption}>Foto profil terdaftar di sistem</div>
                </div>

                {/* Foto Saat Absen */}
                <div style={styles.photoCard}>
                  <div style={styles.photoBadgeAbsen}>Foto Saat Absen (Selfie)</div>
                  <div style={styles.photoContainer}>
                    {selectedPhotoModal.attendance_photo ? (
                      <img
                        src={getImageUrl(selectedPhotoModal.attendance_photo)}
                        alt="Foto Absen"
                        style={styles.compareImg}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div style={{
                      display: selectedPhotoModal.attendance_photo ? 'none' : 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      background: '#f1f5f9',
                      color: '#64748b',
                      fontSize: 12,
                      padding: 16,
                      textAlign: 'center',
                    }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span style={{ marginTop: 6 }}>Foto absen tidak tersedia</span>
                    </div>
                  </div>
                  <div style={styles.photoCaption}>
                    Diambil: {selectedPhotoModal.created_at ? new Date(selectedPhotoModal.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':') : '-'} ({selectedPhotoModal.type === 'out' ? 'Clock Out' : 'Clock In'})
                  </div>
                  <div style={styles.photoDateCaption}>
                    pada tanggal {selectedPhotoModal.created_at ? new Date(selectedPhotoModal.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '-'}
                  </div>
                </div>
              </div>

              {/* Confidence & Detection Details */}
              <div style={styles.scoreBox}>
                <div style={styles.scoreRow}>
                  <div>
                    <span style={styles.scoreLabel}>Status Kehadiran Saat Ini:</span>
                    <h4 style={styles.scoreTitle}>
                      {isApproved(selectedPhotoModal.status)
                        ? 'Disetujui (Clock In)'
                        : isRejected(selectedPhotoModal.status)
                        ? 'Ditolak (Wajah Tidak Cocok)'
                        : 'Menunggu Review'}
                    </h4>
                  </div>
                  <div
                    style={{
                      ...styles.statusTag,
                      background: isApproved(selectedPhotoModal.status) ? '#dcfce7' : isRejected(selectedPhotoModal.status) ? '#fee2e2' : '#f1f5f9',
                      color: isApproved(selectedPhotoModal.status) ? '#166534' : isRejected(selectedPhotoModal.status) ? '#991b1b' : '#475569',
                      borderColor: isApproved(selectedPhotoModal.status) ? '#86efac' : isRejected(selectedPhotoModal.status) ? '#fca5a5' : '#cbd5e1',
                    }}
                  >
                    {isApproved(selectedPhotoModal.status)
                      ? '✓ Hadir (Disetujui)'
                      : isRejected(selectedPhotoModal.status)
                      ? '✕ Ditolak (Wajah Tidak Cocok)'
                      : 'Menunggu Approval Admin'}
                  </div>
                </div>
                {selectedPhotoModal.notes && <p style={styles.scoreNotes}>{selectedPhotoModal.notes}</p>}
              </div>
            </div>

            {/* Quick Actions in Modal */}
            <div style={styles.modalFooter}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    handleApprovalChange(selectedPhotoModal.id, 'Clock In');
                    setSelectedPhotoModal(null);
                  }}
                  style={styles.modalBtnMatch}
                >
                  ✓ Setujui (Clock In pada Jam Presensi)
                </button>
                <button
                  onClick={() => {
                    handleApprovalChange(selectedPhotoModal.id, 'Wajah Tidak Cocok');
                    setSelectedPhotoModal(null);
                  }}
                  style={styles.modalBtnMismatch}
                >
                  ✕ Tolak (Terhitung Alpha & Tidak Masuk Log Absen)
                </button>
              </div>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                style={styles.modalBtnClose}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
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
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  limitBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#ffffff',
    border: '1.5px solid #d1d9e6',
    borderRadius: 10,
    padding: '5px 12px',
    height: 42,
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  },
  limitLabel: {
    fontSize: 12.5,
    fontWeight: 600,
    color: '#64748b',
    whiteSpace: 'nowrap',
  },
  limitSelect: {
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 600,
    color: '#1e5a8a',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
    padding: '2px 0',
  },
  searchBox: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minWidth: 260,
    flex: '1 1 260px',
    maxWidth: 360,
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
    color: '#64748b',
  },
  searchInput: {
    width: '100%',
    padding: '9px 34px 9px 36px',
    borderRadius: 10,
    border: '1.5px solid #d1d9e6',
    fontSize: 13,
    color: '#1a1a2e',
    outline: 'none',
    background: '#ffffff',
    transition: 'all 0.18s ease',
    fontFamily: 'inherit',
    height: 42,
    boxSizing: 'border-box',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 10,
    background: '#e2e8f0',
    border: 'none',
    borderRadius: '50%',
    width: 18,
    height: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    color: '#64748b',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.15s ease',
  },
  statusFilterBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#ffffff',
    padding: '5px 12px',
    borderRadius: 10,
    border: '1.5px solid #d1d9e6',
    height: 42,
    boxSizing: 'border-box',
  },
  statusFilterLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: '#64748b',
  },
  statusFilterSelect: {
    border: 'none',
    outline: 'none',
    fontSize: 13,
    fontWeight: 600,
    color: '#1e5a8a',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabsWrapper: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginLeft: 'auto',
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
  tableFooter: {
    padding: '14px 20px',
    background: '#f8fafc',
    borderTop: '1px solid #e8ecf1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  footerInfo: {
    fontSize: 13,
    color: '#64748b',
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  pageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#1e5a8a',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
  },
  pageIndicator: {
    fontSize: 12.5,
    color: '#64748b',
    padding: '0 6px',
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
  usernameBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    background: '#eaf0f7',
    borderRadius: 8,
    fontSize: 12.5,
    fontWeight: 500,
    color: '#1e5a8a',
    fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
  },
  photoBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#eaf2fd',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.18s ease',
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
  optionMatch: {
    background: '#ffffff',
    color: '#166534',
    fontWeight: 'bold',
  },
  optionMismatch: {
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
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
    animation: 'fadeIn 0.2s ease-out',
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 640,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    animation: 'fadeInUp 0.25s ease-out',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '1px solid #f1f5f9',
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#eaf0f7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
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
    padding: 4,
    borderRadius: 6,
  },
  modalBody: {
    padding: '24px',
  },
  compareGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  photoCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 12,
    textAlign: 'center',
  },
  photoBadgeMaster: {
    fontSize: 11,
    fontWeight: 600,
    color: '#1e5a8a',
    background: '#eaf0f7',
    padding: '3px 8px',
    borderRadius: 6,
    display: 'inline-block',
    marginBottom: 10,
  },
  photoBadgeAbsen: {
    fontSize: 11,
    fontWeight: 600,
    color: '#0369a1',
    background: '#e0f2fe',
    padding: '3px 8px',
    borderRadius: 6,
    display: 'inline-block',
    marginBottom: 10,
  },
  photoContainer: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    overflow: 'hidden',
    background: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoCaption: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 8,
  },
  photoDateCaption: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 3,
    fontWeight: 500,
  },
  scoreBox: {
    marginTop: 18,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 16,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: 500,
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#1e293b',
    margin: '2px 0 0',
  },
  statusTag: {
    padding: '4px 12px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 12,
    fontWeight: 700,
  },
  scoreNotes: {
    fontSize: 12,
    color: '#64748b',
    margin: '10px 0 0',
    lineHeight: 1.4,
  },
  modalFooter: {
    padding: '16px 24px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    background: '#f8fafc',
  },
  modalBtnMatch: {
    padding: '8px 16px',
    background: '#16a34a',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modalBtnMismatch: {
    padding: '8px 16px',
    background: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  modalBtnClose: {
    padding: '8px 18px',
    background: '#ffffff',
    color: '#64748b',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginLeft: 16,
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
};
