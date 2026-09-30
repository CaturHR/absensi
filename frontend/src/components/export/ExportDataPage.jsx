import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { fetchAttendanceLogs, fetchLocations, fetchUsers, fetchLeaveRequests } from '../../services/api';

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

// Hitung jumlah hari kerja (Senin - Jumat) dalam rentang tanggal
function countWorkdays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (start > end) return 0;

  let workdays = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay(); // 0: Minggu, 6: Sabtu
    if (day !== 0 && day !== 6) {
      workdays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  // Jika rentang hanya memilih akhir pekan (workdays === 0), kembalikan jumlah hari kalender
  if (workdays === 0) {
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1;
    return Math.max(1, diff);
  }

  return workdays;
}

export default function ExportDataPage({ onBack, onLogout }) {
  // Rentang tanggal default sesuai tanggal aktif
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-25');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [locations, setLocations] = useState([]);

  const startDateInputRef = useRef(null);
  const endDateInputRef = useRef(null);

  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [userSummaries, setUserSummaries] = useState([]);
  const [totalRawLogs, setTotalRawLogs] = useState(0);
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

  // Hitung rekapitulasi data per user (Hadir, Izin, Alpha)
  useEffect(() => {
    let isCancelled = false;

    async function calculateUserSummaries() {
      if (!startDate || !endDate) return;
      setIsLoadingPreview(true);

      try {
        // 1. Ambil seluruh data pengguna
        const usersRes = await fetchUsers();
        const allUsers = (usersRes && usersRes.data ? usersRes.data : []).filter(
          (u) => u.role !== 'admin'
        );

        // 2. Ambil seluruh log absensi dalam rentang tanggal
        const logsRes = await fetchAttendanceLogs({
          date_from: startDate,
          date_to: endDate,
          location_id: selectedLocation,
          limit: 5000,
        });
        const logs = logsRes && logsRes.data ? logsRes.data : [];

        // 3. Ambil data izin resmi yang disetujui dari tabel leave_requests
        let approvedLeaves = [];
        try {
          const leavesRes = await fetchLeaveRequests({
            status: 'approved',
            date_from: startDate,
            date_to: endDate,
            limit: 1000,
          });
          if (leavesRes && leavesRes.data) {
            approvedLeaves = leavesRes.data;
          }
        } catch {
          // ignore jika error
        }

        if (isCancelled) return;

        setTotalRawLogs(logs.length);

        const totalWorkDays = countWorkdays(startDate, endDate);

        // Map list user dan hitung Hadir, Izin, Alpha
        // Jika ada user di logs yang tidak ada di allUsers (misal admin atau user lama), kita gabungkan
        const userMap = new Map();
        allUsers.forEach((u) => {
          userMap.set(u.id, {
            id: u.id,
            name: u.name,
            nip: u.nip || '-',
            email: u.email || '-',
            department: u.department || 'Operasional',
          });
        });

        logs.forEach((log) => {
          if (log.user_id && !userMap.has(log.user_id)) {
            userMap.set(log.user_id, {
              id: log.user_id,
              name: log.user_name || `User #${log.user_id}`,
              nip: log.user_nip || '-',
              email: log.user_email || '-',
              department: log.department || 'Operasional',
            });
          }
        });

        // Hitung statistik per user
        const summaries = Array.from(userMap.values()).map((user) => {
          const userLogs = logs.filter((l) => l.user_id === user.id);
          const userLeaves = approvedLeaves.filter((l) => l.user_id === user.id);

          const hadirDates = new Set();
          const izinDates = new Set();

          // Cek tanggal hadir & izin dari attendance_logs
          userLogs.forEach((log) => {
            const dateStr = log.created_at ? log.created_at.slice(0, 10) : '';
            if (!dateStr) return;

            const st = (log.status || '').toLowerCase();
            if (st.includes('izin') || st.includes('leave')) {
              izinDates.add(dateStr);
            } else if (
              st.includes('clock in') ||
              st.includes('clock out') ||
              st.includes('hadir') ||
              st.includes('radius') ||
              st.includes('cocok')
            ) {
              hadirDates.add(dateStr);
            }
          });

          // Cek permohonan izin yang disetujui dalam rentang tanggal
          userLeaves.forEach((leave) => {
            const dateStr = (leave.date || leave.created_at || '').slice(0, 10);
            if (dateStr && dateStr >= startDate && dateStr <= endDate) {
              izinDates.add(dateStr);
            }
          });

          // Tanggal hadir diutamakan daripada izin
          const hadirCount = hadirDates.size;
          const effectiveIzinDates = Array.from(izinDates).filter((d) => !hadirDates.has(d));
          const izinCount = effectiveIzinDates.length;

          // Alpha = Hari Kerja - (Hadir + Izin)
          const alphaCount = Math.max(0, totalWorkDays - (hadirCount + izinCount));

          // Tingkat kehadiran (%)
          const attendanceRate =
            totalWorkDays > 0
              ? Math.min(100, Math.round((hadirCount / totalWorkDays) * 100))
              : 100;

          return {
            id: user.id,
            name: user.name,
            nip: user.nip,
            email: user.email,
            department: user.department,
            totalWorkDays,
            hadirCount,
            izinCount,
            alphaCount,
            attendanceRate,
          };
        });

        // Urutkan berdasarkan nama karyawan
        summaries.sort((a, b) => a.name.localeCompare(b.name));

        setUserSummaries(summaries);
      } catch (err) {
        console.error('Error generating attendance summary:', err);
        if (!isCancelled) {
          setUserSummaries([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    calculateUserSummaries();

    return () => {
      isCancelled = true;
    };
  }, [startDate, endDate, selectedLocation]);

  // Handle Export Excel (.xlsx) dengan format Rekapitulasi Per User + Detail Log
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
      // 1. Ambil data log absensi detail
      const res = await fetchAttendanceLogs({
        date_from: startDate,
        date_to: endDate,
        location_id: selectedLocation,
        limit: 5000,
      });

      const logs = res && res.data ? res.data : [];

      if (userSummaries.length === 0 && logs.length === 0) {
        showNotif('info', 'Tidak ada data absensi pada rentang tanggal dan lokasi yang dipilih.');
        setIsExporting(false);
        return;
      }

      const workbook = XLSX.utils.book_new();

      // ─────────────────────────────────────────────────────────────
      // SHEET 1: Rekapitulasi Kehadiran Per Karyawan (Hadir, Izin, Alpha)
      // ─────────────────────────────────────────────────────────────
      const summaryRows = userSummaries.map((item, idx) => ({
        'No': idx + 1,
        'Nama Karyawan': item.name || '-',
        'NIP': item.nip || '-',
        'Email': item.email || '-',
        'Departemen': item.department || '-',
        'Total Hari Kerja': item.totalWorkDays,
        'Jumlah Hadir': item.hadirCount,
        'Jumlah Izin': item.izinCount,
        'Jumlah Alpha': item.alphaCount,
        'Persentase Kehadiran (%)': `${item.attendanceRate}%`,
      }));

      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet['!cols'] = [
        { wch: 6 },  // No
        { wch: 26 }, // Nama Karyawan
        { wch: 18 }, // NIP
        { wch: 28 }, // Email
        { wch: 18 }, // Departemen
        { wch: 18 }, // Total Hari Kerja
        { wch: 15 }, // Jumlah Hadir
        { wch: 15 }, // Jumlah Izin
        { wch: 15 }, // Jumlah Alpha
        { wch: 24 }, // Persentase Kehadiran (%)
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Rekapitulasi Kehadiran');

      // ─────────────────────────────────────────────────────────────
      // SHEET 2: Detail Log Absensi Lengkap
      // ─────────────────────────────────────────────────────────────
      if (logs.length > 0) {
        const detailRows = logs.map((item, idx) => {
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
            'Lokasi Presensi': item.location_name || 'Kantor Pusat',
            'Status Kehadiran': item.status || '-',
            'Akurasi Wajah (%)':
              item.face_confidence !== null && item.face_confidence !== undefined
                ? `${item.face_confidence}%`
                : '-',
            'Jarak ke Kantor (m)':
              item.distance !== undefined && item.distance !== null
                ? `${item.distance} meter`
                : '-',
            'Latitude': item.latitude || '-',
            'Longitude': item.longitude || '-',
            'Keterangan': item.notes || '-',
          };
        });

        const detailSheet = XLSX.utils.json_to_sheet(detailRows);
        detailSheet['!cols'] = [
          { wch: 6 },  // No
          { wch: 20 }, // Tanggal
          { wch: 12 }, // Jam
          { wch: 25 }, // Nama Karyawan
          { wch: 18 }, // NIP
          { wch: 28 }, // Email
          { wch: 24 }, // Lokasi Presensi
          { wch: 18 }, // Status Kehadiran
          { wch: 18 }, // Akurasi Wajah
          { wch: 20 }, // Jarak ke Kantor
          { wch: 14 }, // Latitude
          { wch: 14 }, // Longitude
          { wch: 30 }, // Keterangan
        ];

        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detail Log Presensi');
      }

      // Download file Excel
      const fileName = `Rekap_Absensi_${startDate}_sd_${endDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      showNotif(
        'success',
        `Berhasil mengunduh Rekap Absensi per Karyawan (${userSummaries.length} Karyawan) ke format Excel (.xlsx)!`
      );
    } catch (err) {
      console.error('Export error:', err);
      showNotif('error', 'Gagal membuat file export: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Hitung total kumulatif untuk widget ringkasan
  const totalHadirAll = userSummaries.reduce((sum, u) => sum + u.hadirCount, 0);
  const totalIzinAll = userSummaries.reduce((sum, u) => sum + u.izinCount, 0);
  const totalAlphaAll = userSummaries.reduce((sum, u) => sum + u.alphaCount, 0);
  const totalWorkDaysCurrent = countWorkdays(startDate, endDate);

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
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1e5a8a"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <div style={styles.headerLogo}>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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

          {onLogout && (
            <button
              onClick={onLogout}
              style={styles.logoutBtn}
              title="Keluar"
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
              background:
                notification.type === 'error'
                  ? '#fef2f2'
                  : notification.type === 'success'
                  ? '#f0fdf4'
                  : '#eff6ff',
              borderColor:
                notification.type === 'error'
                  ? '#fecaca'
                  : notification.type === 'success'
                  ? '#bbf7d0'
                  : '#bfdbfe',
              color:
                notification.type === 'error'
                  ? '#dc2626'
                  : notification.type === 'success'
                  ? '#16a34a'
                  : '#1d4ed8',
            }}
          >
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} style={styles.toastClose}>
              ✕
            </button>
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
              <h2 style={styles.pageTitle}>Export Rekap Data Absensi</h2>
              <p style={styles.pageSubtitle}>
                Format export per user dengan akumulasi jumlah Hadir, Izin, dan Alpha
              </p>
            </div>
          </div>

          {/* Form Card Filter */}
          <div style={styles.card}>
            {/* Rentang Tanggal Section */}
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🗓️</span>
              <span style={styles.sectionTitle}>Rentang Tanggal Periode</span>
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
            <div style={{ marginTop: 20 }}>
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
                  <option value="all">Semua Lokasi Kantor</option>
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

            {/* Summary KPI Badges */}
            <div style={styles.kpiGrid}>
              <div style={{ ...styles.kpiCard, borderLeft: '4px solid #1e5a8a' }}>
                <span style={styles.kpiLabel}>Total Hari Kerja</span>
                <span style={styles.kpiVal}>{totalWorkDaysCurrent} Hari</span>
              </div>
              <div style={{ ...styles.kpiCard, borderLeft: '4px solid #16a34a' }}>
                <span style={styles.kpiLabel}>Total Hadir</span>
                <span style={{ ...styles.kpiVal, color: '#16a34a' }}>{totalHadirAll}</span>
              </div>
              <div style={{ ...styles.kpiCard, borderLeft: '4px solid #ca8a04' }}>
                <span style={styles.kpiLabel}>Total Izin</span>
                <span style={{ ...styles.kpiVal, color: '#ca8a04' }}>{totalIzinAll}</span>
              </div>
              <div style={{ ...styles.kpiCard, borderLeft: '4px solid #dc2626' }}>
                <span style={styles.kpiLabel}>Total Alpha</span>
                <span style={{ ...styles.kpiVal, color: '#dc2626' }}>{totalAlphaAll}</span>
              </div>
            </div>

            {/* Live Preview Table Per User */}
            <div style={styles.previewSection}>
              <div style={styles.previewHeaderRow}>
                <span style={styles.previewTitle}>
                  👥 Ringkasan Presensi Per Karyawan ({userSummaries.length} Orang)
                </span>
                {isLoadingPreview && (
                  <span style={styles.calculatingBadge}>Menghitung data...</span>
                )}
              </div>

              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: '40px' }}>No</th>
                      <th style={styles.th}>Nama Karyawan</th>
                      <th style={styles.th}>NIP</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Hadir</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Izin</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Alpha</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoadingPreview ? (
                      <tr>
                        <td colSpan={7} style={styles.emptyTd}>
                          <div style={styles.tableSpinner} />
                          <span>Memuat rekapitulasi data per karyawan...</span>
                        </td>
                      </tr>
                    ) : userSummaries.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={styles.emptyTd}>
                          Belum ada data absensi untuk rentang tanggal ini.
                        </td>
                      </tr>
                    ) : (
                      userSummaries.map((user, idx) => (
                        <tr
                          key={user.id || idx}
                          style={idx % 2 === 0 ? styles.trEven : styles.trOdd}
                        >
                          <td style={styles.tdCenter}>{idx + 1}</td>
                          <td style={styles.tdName}>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>{user.name}</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>{user.email}</div>
                          </td>
                          <td style={styles.tdText}>{user.nip || '-'}</td>
                          <td style={styles.tdCenter}>
                            <span style={styles.badgeHadir}>{user.hadirCount}</span>
                          </td>
                          <td style={styles.tdCenter}>
                            <span style={styles.badgeIzin}>{user.izinCount}</span>
                          </td>
                          <td style={styles.tdCenter}>
                            <span style={styles.badgeAlpha}>{user.alphaCount}</span>
                          </td>
                          <td style={styles.tdCenter}>
                            <span
                              style={{
                                ...styles.badgeRate,
                                background:
                                  user.attendanceRate >= 80
                                    ? '#f0fdf4'
                                    : user.attendanceRate >= 50
                                    ? '#fefce8'
                                    : '#fef2f2',
                                color:
                                  user.attendanceRate >= 80
                                    ? '#16a34a'
                                    : user.attendanceRate >= 50
                                    ? '#ca8a04'
                                    : '#dc2626',
                              }}
                            >
                              {user.attendanceRate}%
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting || isLoadingPreview || userSummaries.length === 0}
              style={{
                ...styles.downloadBtn,
                opacity: isExporting || isLoadingPreview || userSummaries.length === 0 ? 0.75 : 1,
                cursor:
                  isExporting || isLoadingPreview || userSummaries.length === 0
                    ? 'not-allowed'
                    : 'pointer',
              }}
              onMouseEnter={(e) => {
                if (!isExporting && userSummaries.length > 0) e.currentTarget.style.background = '#164e7d';
              }}
              onMouseLeave={(e) => {
                if (!isExporting && userSummaries.length > 0) e.currentTarget.style.background = '#1a5695';
              }}
            >
              {isExporting ? (
                <>
                  <div style={styles.buttonSpinner} />
                  <span>Membuat File Excel Rekapitulasi...</span>
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
                  <span>Download Rekap Absensi (.xlsx)</span>
                </>
              )}
            </button>

            {/* Data count hint */}
            <div style={styles.dataHint}>
              {isLoadingPreview ? (
                <span>Menghitung data presensi...</span>
              ) : userSummaries.length > 0 ? (
                <span>
                  ✓ Siap mengekspor rekapitulasi <strong>{userSummaries.length}</strong> karyawan ({totalRawLogs} riwayat log presensi)
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
    padding: '10px 24px 40px',
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
    maxWidth: 800,
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
    maxWidth: 820,
    width: '100%',
    boxSizing: 'border-box',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 22,
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    color: '#718096',
    margin: '4px 0 0',
    fontWeight: 400,
  },
  card: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '28px 32px',
    boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)',
    border: '1px solid #e8ecf1',
    boxSizing: 'border-box',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#1a1a2e',
    letterSpacing: '-0.01em',
  },
  dateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 14,
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
    padding: '10px 14px',
    background: '#ffffff',
    border: '1.5px solid #d1d5db',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dateDisplayText: {
    fontSize: 13,
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
    padding: '10px 36px 10px 14px',
    borderRadius: 10,
    border: '1.5px solid #d1d5db',
    background: '#ffffff',
    fontSize: 13,
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
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  kpiCard: {
    background: '#f8fafc',
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  kpiVal: {
    fontSize: 17,
    fontWeight: 700,
    color: '#1e293b',
  },
  previewSection: {
    marginTop: 8,
    marginBottom: 20,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#334155',
  },
  calculatingBadge: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
  },
  tableWrapper: {
    maxHeight: 280,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12.5,
    textAlign: 'left',
  },
  th: {
    position: 'sticky',
    top: 0,
    background: '#f1f5f9',
    color: '#475569',
    fontWeight: 600,
    padding: '9px 12px',
    borderBottom: '1px solid #cbd5e1',
    zIndex: 2,
  },
  trEven: {
    background: '#ffffff',
  },
  trOdd: {
    background: '#fbfcfd',
  },
  tdCenter: {
    padding: '9px 12px',
    textAlign: 'center',
    borderBottom: '1px solid #f1f5f9',
  },
  tdText: {
    padding: '9px 12px',
    color: '#334155',
    borderBottom: '1px solid #f1f5f9',
  },
  tdName: {
    padding: '9px 12px',
    borderBottom: '1px solid #f1f5f9',
  },
  emptyTd: {
    padding: '24px',
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
  },
  tableSpinner: {
    width: 18,
    height: 18,
    border: '2px solid #cbd5e1',
    borderTopColor: '#1e5a8a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 8px',
  },
  badgeHadir: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 6,
    background: '#dcfce7',
    color: '#15803d',
    fontWeight: 700,
    fontSize: 12,
  },
  badgeIzin: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 6,
    background: '#fef9c3',
    color: '#a16207',
    fontWeight: 700,
    fontSize: 12,
  },
  badgeAlpha: {
    display: 'inline-block',
    padding: '3px 9px',
    borderRadius: 6,
    background: '#fee2e2',
    color: '#b91c1c',
    fontWeight: 700,
    fontSize: 12,
  },
  badgeRate: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 6,
    fontWeight: 700,
    fontSize: 11.5,
  },
  downloadBtn: {
    width: '100%',
    padding: '13px 20px',
    background: '#1a5695',
    color: '#ffffff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
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
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    minHeight: 18,
  },
};
