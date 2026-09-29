import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { fetchAttendanceLogs, fetchLocations } from '../../services/api';

// Format helper: '2026-09-01' -> '01 September 2026'
function formatToIndonesianDate(dateStr) {
  if (!dateStr) return '';
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2].padStart(2, '0');
  return `${day} ${months[monthIdx] || parts[1]} ${year}`;
}

export default function ExportDataPage({ onBack, onLogout }) {
  // Rentang tanggal default sesuai screenshot (01 September 2026 s/d 25 September 2026)
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-25');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [locations, setLocations] = useState([]);

  const startDateInputRef = useRef(null);
  const endDateInputRef = useRef(null);
  
  const [isExporting, setIsExporting] = useState(false);
  const [previewCount, setPreviewCount] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotif = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Muat daftar lokasi kantor
  useEffect(() => {
    async function loadLocations() {
      try {
        const res = await fetchLocations();
        if (res && res.data) {
          setLocations(res.data);
        }
      } catch (err) {
        console.error('Error loading locations:', err);
      }
    }
    loadLocations();
  }, []);

  // Hitung jumlah data yang sesuai rentang tanggal & lokasi
  useEffect(() => {
    let isCancelled = false;
    async function calculateCount() {
      setIsLoadingPreview(true);
      try {
        const res = await fetchAttendanceLogs({
          date_from: startDate,
          date_to: endDate,
          location_id: selectedLocation,
          limit: 1000,
        });
        if (!isCancelled && res && res.data) {
          setPreviewCount(res.data.length);
        }
      } catch {
        if (!isCancelled) setPreviewCount(0);
      } finally {
        if (!isCancelled) setIsLoadingPreview(false);
      }
    }

    if (startDate && endDate) {
      calculateCount();
    }
    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate, selectedLocation]);

  // Handle Export Excel (.xlsx)
  const handleDownloadExcel = async () => {
    if (!startDate || !endDate) {
      showNotif('error', 'Silakan pilih rentang tanggal yang lengkap.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      showNotif('error', 'Tanggal awal tidak boleh lebih besar dari tanggal akhir.');
      return;
    }

    setIsExporting(true);

    try {
      // Ambil data absensi sesuai filter
      const res = await fetchAttendanceLogs({
        date_from: startDate,
        date_to: endDate,
        location_id: selectedLocation,
        limit: 5000,
      });

      const logs = res && res.data ? res.data : [];

      if (logs.length === 0) {
        showNotif('info', 'Tidak ada data absensi pada rentang tanggal dan lokasi yang dipilih.');
        setIsExporting(false);
        return;
      }

      // Siapkan data untuk SheetJS Excel
      const excelRows = logs.map((item, idx) => {
        const dateObj = new Date(item.created_at);
        const formattedDate = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString('id-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              timeZone: 'Asia/Jakarta',
            })
          : item.created_at || '-';

        const formattedTime = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone: 'Asia/Jakarta',
            })
          : '-';

        return {
          'No': idx + 1,
          'Tanggal': formattedDate,
          'Jam': formattedTime,
          'Nama Karyawan': item.user_name || '-',
          'NIP': item.user_nip || '-',
          'Email': item.user_email || '-',
          'Departemen': item.department || '-',
          'Lokasi Kantor': item.location_name || 'Kantor Pusat Jakarta',
          'Status Kehadiran': item.status || '-',
          'Akurasi Wajah (%)': item.face_confidence !== null && item.face_confidence !== undefined ? `${item.face_confidence}%` : '-',
          'Jarak ke Kantor (m)': item.distance !== undefined ? `${item.distance} meter` : '-',
          'Latitude': item.latitude || '-',
          'Longitude': item.longitude || '-',
          'Keterangan': item.notes || '-',
        };
      });

      // Buat Worksheet & Workbook
      const worksheet = XLSX.utils.json_to_sheet(excelRows);

      // Atur lebar kolom agar rapi
      worksheet['!cols'] = [
        { wch: 6 },  // No
        { wch: 20 }, // Tanggal
        { wch: 12 }, // Jam
        { wch: 25 }, // Nama Karyawan
        { wch: 18 }, // NIP
        { wch: 28 }, // Email
        { wch: 20 }, // Departemen
        { wch: 26 }, // Lokasi Kantor
        { wch: 18 }, // Status Kehadiran
        { wch: 18 }, // Akurasi Wajah
        { wch: 20 }, // Jarak ke Kantor
        { wch: 14 }, // Latitude
        { wch: 14 }, // Longitude
        { wch: 32 }, // Keterangan
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Absensi');

      // Nama file Excel yang rapi
      const fileName = `Export_Absensi_${startDate}_sd_${endDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showNotif('success', `Berhasil mengunduh ${logs.length} data absensi (.xlsx)!`);
    } catch (err) {
      console.error('Export error:', err);
      showNotif('error', 'Gagal membuat file export: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Top Header Bar */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.headerLeft}>
            {onBack && (
              <button
                onClick={onBack}
                style={styles.backBtn}
                title="Kembali ke Menu Utama"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(30,90,138,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e5a8a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
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

          {onLogout && (
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
          )}
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

        <div style={styles.contentContainer}>
          {/* Header Title & Subtitle */}
          <div style={styles.pageHeader}>
            <div style={styles.iconContainer}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1e5a8a"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <h2 style={styles.pageTitle}>Export Data Absensi</h2>
              <p style={styles.pageSubtitle}>
                Pilih rentang tanggal dan lokasi kantor untuk mengunduh data
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div style={styles.card}>
            {/* Rentang Tanggal Section */}
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🗓️</span>
              <span style={styles.sectionTitle}>Rentang Tanggal Absensi</span>
            </div>

            <div style={styles.dateGrid}>
              {/* Dari Tanggal */}
              <div>
                <label style={styles.fieldLabel}>Dari Tanggal</label>
                <div
                  style={styles.dateInputWrapper}
                  onClick={() => startDateInputRef.current?.showPicker?.()}
                >
                  <span style={styles.dateDisplayText}>
                    {formatToIndonesianDate(startDate) || 'Pilih Tanggal'}
                  </span>
                  <svg
                    style={styles.chevronIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <input
                    ref={startDateInputRef}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={styles.hiddenDateInput}
                  />
                </div>
              </div>

              {/* Sampai Tanggal */}
              <div>
                <label style={styles.fieldLabel}>Sampai Tanggal</label>
                <div
                  style={styles.dateInputWrapper}
                  onClick={() => endDateInputRef.current?.showPicker?.()}
                >
                  <span style={styles.dateDisplayText}>
                    {formatToIndonesianDate(endDate) || 'Pilih Tanggal'}
                  </span>
                  <svg
                    style={styles.chevronIcon}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <input
                    ref={endDateInputRef}
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={styles.hiddenDateInput}
                  />
                </div>
              </div>
            </div>

            {/* Lokasi Kantor Section */}
            <div style={{ marginTop: 24 }}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionIcon}>📍</span>
                <span style={styles.sectionTitle}>Lokasi Kantor</span>
              </div>

              <div style={styles.selectWrapper}>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  style={styles.selectInput}
                >
                  <option value="all">Semua Lokasi</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                <svg
                  style={styles.selectArrow}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              style={{
                ...styles.downloadBtn,
                opacity: isExporting ? 0.75 : 1,
                cursor: isExporting ? 'not-allowed' : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isExporting) e.currentTarget.style.background = '#164e7d';
              }}
              onMouseLeave={(e) => {
                if (!isExporting) e.currentTarget.style.background = '#1a5695';
              }}
            >
              {isExporting ? (
                <>
                  <div style={styles.buttonSpinner} />
                  <span>Memproses Export Excel...</span>
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Download Data Absensi (.xlsx)</span>
                </>
              )}
            </button>

            {/* Data count hint */}
            <div style={styles.dataHint}>
              {isLoadingPreview ? (
                <span>Menghitung data yang tersedia...</span>
              ) : previewCount !== null ? (
                <span>
                  ✓ Siap mengekspor <strong>{previewCount}</strong> baris data absensi
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </main>

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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 24px 30px',
    width: '100%',
    maxWidth: 1200,
    margin: '0 auto',
    boxSizing: 'border-box',
    animation: 'fadeInUp 0.5s ease-out 0.1s both',
  },
  toast: {
    padding: '12px 18px',
    borderRadius: 12,
    border: '1px solid',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    maxWidth: 620,
    width: '100%',
    boxSizing: 'border-box',
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
  contentContainer: {
    maxWidth: 640,
    width: '100%',
    boxSizing: 'border-box',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 26,
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: '#1a1a2e',
    margin: 0,
    letterSpacing: '-0.02em',
  },
  pageSubtitle: {
    fontSize: 13.5,
    color: '#718096',
    margin: '4px 0 0',
    fontWeight: 400,
  },
  card: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '32px 36px',
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)',
    border: '1px solid #e8ecf1',
    boxSizing: 'border-box',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionIcon: {
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1a1a2e',
    letterSpacing: '-0.01em',
  },
  dateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  fieldLabel: {
    display: 'block',
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: 500,
  },
  dateInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 16px',
    background: '#ffffff',
    border: '1.5px solid #d1d5db',
    borderRadius: 12,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dateDisplayText: {
    fontSize: 13.5,
    color: '#1e293b',
    fontWeight: 500,
  },
  chevronIcon: {
    pointerEvents: 'none',
    flexShrink: 0,
  },
  hiddenDateInput: {
    position: 'absolute',
    inset: 0,
    opacity: 0,
    cursor: 'pointer',
    width: '100%',
    height: '100%',
  },
  selectWrapper: {
    position: 'relative',
    width: '100%',
  },
  selectInput: {
    width: '100%',
    appearance: 'none',
    WebkitAppearance: 'none',
    padding: '11px 36px 11px 16px',
    borderRadius: 10,
    border: '1.5px solid #d1d5db',
    background: '#ffffff',
    fontSize: 13.5,
    color: '#1e293b',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s ease',
  },
  selectArrow: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  downloadBtn: {
    width: '100%',
    marginTop: 26,
    padding: '13px 20px',
    background: '#1a5695',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14.5,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 14px rgba(26, 86, 149, 0.25)',
  },
  buttonSpinner: {
    width: 16,
    height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  dataHint: {
    marginTop: 14,
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    minHeight: 18,
  },
};
