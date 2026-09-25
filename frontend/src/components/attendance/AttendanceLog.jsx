import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  MapPinOff,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Calendar,
  Clock,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Download,
} from 'lucide-react';
import AttendanceDetailModal from './AttendanceDetailModal';
import { fetchAttendanceLogs } from '../../services/api';
import { MOCK_ATTENDANCE_LOGS } from '../../data/mockData';
import { getImageUrl } from '../../utils/imageUrl';

export default function AttendanceLog() {
  const [logs, setLogs] = useState(MOCK_ATTENDANCE_LOGS);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isMockMode, setIsMockMode] = useState(true);
  const itemsPerPage = 6;

  // Fetch data on load
  const loadAttendance = async () => {
    setLoading(true);
    try {
      const response = await fetchAttendanceLogs({
        status: statusFilter,
        search: searchQuery,
      });
      if (response && response.data) {
        setLogs(response.data);
        setIsMockMode(response.isMock ?? true);
      }
    } catch (err) {
      console.warn('Fallback to embedded mock data:', err);
      setLogs(MOCK_ATTENDANCE_LOGS);
      setIsMockMode(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, [statusFilter]);

  // Metric summaries
  const metrics = useMemo(() => {
    const total = logs.length;
    const hadir = logs.filter((l) => l.status === 'Hadir').length;
    const outOfRadius = logs.filter((l) => l.status === 'Di Luar Radius').length;
    const mismatch = logs.filter(
      (l) => l.status === 'Wajah Tidak Cocok' || l.status === 'Gagal Verifikasi Wajah'
    ).length;

    return { total, hadir, outOfRadius, mismatch };
  }, [logs]);

  // Client-side filtering for immediate snappy responsiveness
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchSearch =
        searchQuery === '' ||
        log.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_nip.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (log.department && log.department.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus = statusFilter === 'all' || log.status === statusFilter;

      let matchDate = true;
      if (dateFilter === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        matchDate = log.created_at.startsWith(today);
      } else if (dateFilter === 'yesterday') {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        matchDate = log.created_at.startsWith(yesterday);
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [logs, searchQuery, statusFilter, dateFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  const handleExportCSV = () => {
    const headers = ['ID', 'Nama Pegawai', 'NIP', 'Tanggal', 'Jam', 'Status', 'Face Confidence (%)', 'Jarak (meter)', 'Latitude', 'Longitude'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.user_name}"`,
      l.user_nip,
      new Date(l.created_at).toLocaleDateString('id-ID'),
      new Date(l.created_at).toLocaleTimeString('id-ID'),
      `"${l.status}"`,
      l.face_confidence ?? '-',
      l.distance,
      l.latitude,
      l.longitude,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `log_absensi_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Log Absensi Karyawan
            </h1>
            {isMockMode && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Mode Preview (Mock Data)
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Pantau riwayat presensi, validasi geofencing lokasi, dan pencocokan biometrik wajah secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAttendance}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs transition-colors"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100/70 shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Attendance Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Presensi
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800 font-mono">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-400">rekaman log</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span>Seluruh data terekam di sistem</span>
          </div>
        </div>

        {/* Hadir (Hijau) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Hadir Valid
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 font-mono">
              {metrics.hadir}
            </span>
            <span className="text-xs text-emerald-700/80 font-medium">
              ({metrics.total ? Math.round((metrics.hadir / metrics.total) * 100) : 0}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Radius aman & biometrik cocok
          </div>
        </div>

        {/* Di Luar Radius (Merah) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Di Luar Radius
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
              <MapPinOff className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 font-mono">
              {metrics.outOfRadius}
            </span>
            <span className="text-xs text-rose-700/80 font-medium">
              ({metrics.total ? Math.round((metrics.outOfRadius / metrics.total) * 100) : 0}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Melebihi jarak batas kantor
          </div>
        </div>

        {/* Wajah Tidak Cocok (Merah / Warning) */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Anomali Wajah
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 font-mono">
              {metrics.mismatch}
            </span>
            <span className="text-xs text-amber-700/80 font-medium">
              ({metrics.total ? Math.round((metrics.mismatch / metrics.total) * 100) : 0}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Skor kemiripan &lt; ambang batas
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama pegawai, NIP, atau departemen..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="Hadir">Hadir (Valid)</option>
              <option value="Di Luar Radius">Di Luar Radius</option>
              <option value="Wajah Tidak Cocok">Wajah Tidak Cocok</option>
            </select>
          </div>

          {/* Date Range Dropdown */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-moss/30 focus:border-moss cursor-pointer"
            >
              <option value="all">Semua Tanggal</option>
              <option value="today">Hari Ini</option>
              <option value="yesterday">Kemarin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table: Attendance Records */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 sm:px-6">Pegawai</th>
                <th className="py-3.5 px-4">Waktu Presensi</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Kemiripan Wajah</th>
                <th className="py-3.5 px-4">Jarak GPS</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <SlidersHorizontal className="w-8 h-8 mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">Tidak ada data absensi yang sesuai</p>
                      <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter status.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const isPresent = log.status === 'Hadir';
                  const isOutOfRadius = log.status === 'Di Luar Radius';
                  const dateObj = new Date(log.created_at);
                  const dateStr = dateObj.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                  const timeStr = dateObj.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-default"
                    >
                      {/* Employee Info */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-200 shrink-0 bg-slate-100">
                            <img
                              src={getImageUrl(log.master_photo || log.photo)}
                              alt={log.user_name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          </div>
                          <div>
                            <span className="font-medium text-slate-800 block hover:text-moss transition-colors">
                              {log.user_name}
                            </span>
                            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                              <span>{log.user_nip}</span>
                              {log.department && (
                                <>
                                  <span>•</span>
                                  <span className="font-sans text-slate-500">{log.department}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="flex flex-col text-xs">
                          <span className="font-medium text-slate-700 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {dateStr}
                          </span>
                          <span className="font-mono text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {timeStr} WIB
                          </span>
                        </div>
                      </td>

                      {/* Status Badges */}
                      <td className="py-3.5 px-4">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Hadir
                          </span>
                        ) : isOutOfRadius ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <MapPinOff className="w-3.5 h-3.5" />
                            Di Luar Radius
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            {log.status}
                          </span>
                        )}
                      </td>

                      {/* Face Similarity Confidence Score */}
                      <td className="py-3.5 px-4">
                        {log.face_confidence !== null ? (
                          <div className="flex flex-col gap-1 max-w-[130px]">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span
                                className={`font-semibold ${
                                  log.face_confidence >= 75
                                    ? 'text-emerald-600'
                                    : log.face_confidence >= 50
                                    ? 'text-amber-600'
                                    : 'text-rose-600'
                                }`}
                              >
                                {log.face_confidence}%
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {log.face_confidence >= 60 ? 'Cocok' : 'Gagal'}
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  log.face_confidence >= 75
                                    ? 'bg-emerald-500'
                                    : log.face_confidence >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                                }`}
                                style={{ width: `${Math.min(log.face_confidence, 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            Dilewati
                          </span>
                        )}
                      </td>

                      {/* Distance */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <span
                          className={`font-semibold ${
                            log.distance <= 100 ? 'text-slate-700' : 'text-rose-600 font-bold'
                          }`}
                        >
                          {log.distance} m
                        </span>
                        <span className="text-slate-400 block text-[11px] font-sans">
                          {log.distance <= 100 ? 'Dalam radius' : 'Luar batas (max 100m)'}
                        </span>
                      </td>

                      {/* Action: Detail Presensi Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs hover:text-moss transition-all"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500 group-hover:text-moss" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Menampilkan{' '}
            <span className="font-semibold text-slate-700">
              {filteredLogs.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
            </span>{' '}
            hingga{' '}
            <span className="font-semibold text-slate-700">
              {Math.min(currentPage * itemsPerPage, filteredLogs.length)}
            </span>{' '}
            dari{' '}
            <span className="font-semibold text-slate-700">
              {filteredLogs.length}
            </span>{' '}
            data absensi
          </div>

          {/* Pagination buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`min-w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-moss text-white font-bold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Detail Presensi Popup */}
      {selectedLog && (
        <AttendanceDetailModal
          attendance={selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
}
