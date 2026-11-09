import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Calendar,
  RotateCcw,
  Clock,
  CheckCircle2,
  LogOut as LogOutIcon,
  FileText,
  UserCheck,
  Paperclip,
  ExternalLink,
  X,
  Eye,
  Image as ImageIcon
} from 'lucide-react';
import { fetchAttendanceLogs } from '../../services/api';
import { getImageUrl } from '../../utils/image';

export default function LogAbsenPage({ onBack, onLogout }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState('15');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedAttachment, setSelectedAttachment] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchAttendanceLogs({
        status: statusFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: currentPage,
        limit: pageSize === 'all' ? 1000 : parseInt(pageSize, 10),
      });

      if (res && res.data) {
        setLogs(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.total);
        } else {
          setTotalCount(res.data.length);
        }
      } else {
        setLogs([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Gagal mengambil data log absensi:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [statusFilter, dateFrom, dateTo, pageSize, currentPage]);

  // Listener tombol Escape untuk menutup modal preview lampiran
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedAttachment(null);
      }
    };
    if (selectedAttachment) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAttachment]);

  // Client-side search filter by Name, NIP, or Divisi
  const filteredLogs = logs.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const name = (item.user_name || '').toLowerCase();
    const nip = (item.user_nip || '').toLowerCase();
    const divisi = (item.divisi || '').toLowerCase();
    return name.includes(query) || nip.includes(query) || divisi.includes(query);
  });

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).replace(/\./g, ':');
    } catch {
      return dateStr;
    }
  };

  const isImageFile = (path = '') => {
    if (!path) return false;
    const clean = String(path).toLowerCase().split('?')[0];
    return (
      clean.endsWith('.jpg') ||
      clean.endsWith('.jpeg') ||
      clean.endsWith('.png') ||
      clean.endsWith('.webp') ||
      clean.endsWith('.gif') ||
      clean.endsWith('.bmp') ||
      clean.endsWith('.svg')
    );
  };

  const getStatusBadge = (status, notes = '') => {
    const s = (status || '').trim().toLowerCase();
    const isNoteIzin = (notes || '').trim().toLowerCase().startsWith('izin');

    // Cek status izin terlebih dahulu (hindari false-match karena 'izin' berakhiran 'in')
    if (s === 'izin' || s.includes('izin') || isNoteIzin) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Izin
        </span>
      );
    }
    if (s === 'clock in' || s === 'in' || s.startsWith('clock in')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Clock In
        </span>
      );
    }
    if (s === 'clock out' || s === 'out' || s.startsWith('clock out')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Clock Out
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        {status}
      </span>
    );
  };

  const handleOpenAttachment = (log) => {
    if (!log.attachment) return;
    setSelectedAttachment({
      url: getImageUrl(log.attachment),
      rawPath: log.attachment,
      userName: log.user_name || 'Karyawan',
      nip: log.user_nip || '-',
      divisi: log.divisi || '-',
      date: formatDateTime(log.created_at),
      notes: log.notes || '',
    });
  };

  const handleResetFilter = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-[#dce6f0] flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all flex items-center gap-2 cursor-pointer"
              title="Kembali ke Menu Utama"
            >
              <ArrowLeft size={20} />
              <span className="text-sm font-medium hidden sm:inline">Menu Utama</span>
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1e5a8a] flex items-center justify-center text-white shadow-sm shadow-blue-900/20">
                <Clock size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Log Absensi Karyawan</h1>
                <p className="text-xs text-gray-500">Melihat catatan Clock In, Clock Out, dan Izin</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
              title="Logout"
            >
              <LogOutIcon size={18} />
              <span className="hidden sm:inline font-medium">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Controls Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Cari berdasarkan nama atau NIP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] transition-all"
              />
            </div>

            {/* Filter by Status */}
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-sm rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1e5a8a]/20 focus:border-[#1e5a8a] cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="Clock In">Clock In</option>
                <option value="Clock Out">Clock Out</option>
                <option value="Izin">Izin</option>
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
                <Calendar size={16} className="text-gray-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-transparent text-gray-700 focus:outline-none"
                  title="Dari Tanggal"
                />
                <span className="text-gray-400 text-xs">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="text-xs bg-transparent text-gray-700 focus:outline-none"
                  title="Sampai Tanggal"
                />
              </div>

              {(searchQuery || statusFilter !== 'all' || dateFrom || dateTo) && (
                <button
                  onClick={handleResetFilter}
                  className="p-2.5 text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all cursor-pointer"
                  title="Reset Filter"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-600 text-xs font-semibold uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3.5 px-4 w-14 text-center">No</th>
                  <th className="py-3.5 px-4">Nama Pegawai</th>
                  <th className="py-3.5 px-4">NIP</th>
                  <th className="py-3.5 px-4">Divisi</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Waktu Absensi</th>
                  <th className="py-3.5 px-4">Catatan</th>
                  <th className="py-3.5 px-4 text-center">Lampiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#1e5a8a] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Memuat data log absensi...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText size={36} className="text-gray-300" />
                        <span className="text-sm font-medium text-gray-500">Tidak ada log absensi ditemukan</span>
                        <span className="text-xs text-gray-400">Cobalah mengubah filter pencarian atau tanggal</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, index) => {
                    const rowNumber = (currentPage - 1) * (pageSize === 'all' ? 0 : parseInt(pageSize, 10)) + index + 1;
                    return (
                      <tr key={log.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3.5 px-4 text-center text-xs font-medium text-gray-500">
                          {rowNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#1e5a8a]/10 text-[#1e5a8a] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {(log.user_name || 'U').charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{log.user_name || '-'}</p>
                              <p className="text-xs text-gray-500 truncate">{log.user_email || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                          {log.user_nip || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
                            {log.divisi || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(log.status, log.notes)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          <div className="flex flex-col gap-1">
                            <span>{log.notes || '-'}</span>
                            {log.attachment && (
                              <button
                                type="button"
                                onClick={() => handleOpenAttachment(log)}
                                className="inline-flex items-center gap-1 text-[11px] text-[#1e5a8a] hover:text-blue-800 hover:underline cursor-pointer w-fit font-medium"
                              >
                                <Paperclip size={12} />
                                <span>Lihat Lampiran</span>
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {log.attachment ? (
                            <div className="flex items-center justify-center gap-2">
                              {isImageFile(log.attachment) && (
                                <img
                                  src={getImageUrl(log.attachment)}
                                  alt="Thumb"
                                  className="w-8 h-8 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shadow-xs"
                                  onClick={() => handleOpenAttachment(log)}
                                  title="Klik untuk memperbesar lampiran"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenAttachment(log)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-[#1e5a8a] hover:bg-[#1e5a8a] hover:text-white border border-[#1e5a8a]/20 transition-all cursor-pointer shadow-xs group"
                                title="Lihat file lampiran"
                              >
                                <Paperclip size={13} className="group-hover:rotate-12 transition-transform" />
                                <span>Lihat File</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer & Pagination */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Menampilkan <strong className="text-gray-700">{filteredLogs.length}</strong> dari{' '}
                <strong className="text-gray-700">{totalCount}</strong> catatan absensi
              </span>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Per halaman:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1e5a8a] cursor-pointer"
                >
                  <option value="15">15</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="all">Semua</option>
                </select>
              </div>
            </div>

            {pageSize !== 'all' && totalCount > parseInt(pageSize, 10) && (
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Sebelumnya
                </button>
                <span className="px-3 py-1 text-xs font-semibold text-gray-700">
                  Halaman {currentPage}
                </span>
                <button
                  disabled={filteredLogs.length < parseInt(pageSize, 10)}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  Selanjutnya
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal Preview Lampiran */}
      {selectedAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedAttachment(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Paperclip size={18} className="text-[#1e5a8a]" />
                  File Lampiran Izin
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedAttachment.userName} ({selectedAttachment.nip}) • {selectedAttachment.divisi} • {selectedAttachment.date}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAttachment(null)}
                className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-gray-50/50">
              {isImageFile(selectedAttachment.rawPath || selectedAttachment.url) ? (
                <div className="w-full flex flex-col items-center">
                  <div className="relative max-h-[60vh] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm flex items-center justify-center">
                    <img
                      src={selectedAttachment.url}
                      alt="Lampiran Izin"
                      className="max-h-[60vh] w-auto object-contain rounded-xl"
                    />
                  </div>
                  {selectedAttachment.notes && (
                    <p className="mt-4 text-xs text-gray-600 bg-white px-4 py-2.5 rounded-xl border border-gray-200 w-full text-center">
                      <span className="font-semibold text-gray-700">Catatan:</span> {selectedAttachment.notes}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <FileText size={48} className="text-[#1e5a8a]" />
                  <span className="text-sm font-semibold text-gray-800">Dokumen Lampiran</span>
                  <span className="text-xs text-gray-500 max-w-xs text-center truncate">
                    {selectedAttachment.rawPath?.split('/').pop() || 'Dokumen'}
                  </span>
                  {selectedAttachment.notes && (
                    <p className="mt-2 text-xs text-gray-600 bg-white px-4 py-2.5 rounded-xl border border-gray-200 w-full text-center">
                      <span className="font-semibold text-gray-700">Catatan:</span> {selectedAttachment.notes}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between">
              <a
                href={selectedAttachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-[#1e5a8a] text-white hover:bg-[#16476e] transition-colors shadow-sm shadow-blue-900/10 cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>Buka di Tab Baru / Download</span>
              </a>

              <button
                type="button"
                onClick={() => setSelectedAttachment(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
