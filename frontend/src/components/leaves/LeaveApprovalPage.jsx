import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  Calendar,
  RotateCcw,
  FileCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  LogOut as LogOutIcon,
  FileText,
  Paperclip,
  ExternalLink,
  X,
  MessageSquare
} from 'lucide-react';
import { fetchLeaveRequests, approveLeave, rejectLeave } from '../../services/api';
import { getImageUrl } from '../../utils/image';

export default function LeaveApprovalPage({ onBack, onLogout }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pageSize, setPageSize] = useState('15');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal preview lampiran
  const [selectedAttachment, setSelectedAttachment] = useState(null);

  // Modal dialog konfirmasi approve & reject
  const [confirmApproveModal, setConfirmApproveModal] = useState(null); // leave object
  const [rejectModal, setRejectModal] = useState(null); // leave object
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const res = await fetchLeaveRequests({
        status: statusFilter,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: currentPage,
        limit: pageSize === 'all' ? 1000 : parseInt(pageSize, 10),
      });

      if (res && res.data) {
        setLeaves(res.data);
        if (res.pagination) {
          setTotalCount(res.pagination.total);
        } else {
          setTotalCount(res.data.length);
        }
      } else {
        setLeaves([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Gagal mengambil data permohonan izin:', err);
      setLeaves([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [statusFilter, dateFrom, dateTo, pageSize, currentPage]);

  // Listener tombol Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedAttachment(null);
        setConfirmApproveModal(null);
        setRejectModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter pencarian sisi klien
  const filteredLeaves = leaves.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const name = (item.user_name || '').toLowerCase();
    const nip = (item.user_nip || '').toLowerCase();
    const reason = (item.reason || '').toLowerCase();
    const divisi = (item.divisi || '').toLowerCase();
    return name.includes(query) || nip.includes(query) || reason.includes(query) || divisi.includes(query);
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

  const getStatusBadge = (status) => {
    const s = (status || '').trim().toLowerCase();
    if (s === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle size={14} className="text-emerald-600" />
          Disetujui
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <XCircle size={14} className="text-red-600" />
          Ditolak
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Menunggu Persetujuan
      </span>
    );
  };

  const handleOpenAttachment = (item) => {
    if (!item.attachment) return;
    setSelectedAttachment({
      url: getImageUrl(item.attachment),
      rawPath: item.attachment,
      userName: item.user_name || 'Karyawan',
      nip: item.user_nip || '-',
      divisi: item.divisi || '-',
      date: formatDateTime(item.created_at),
      reason: item.reason || '',
      description: item.description || '',
    });
  };

  const handleApprove = async () => {
    if (!confirmApproveModal) return;
    setActionLoading(true);
    try {
      await approveLeave(confirmApproveModal.id);
      setConfirmApproveModal(null);
      setAlertMessage({ type: 'success', text: `Izin untuk ${confirmApproveModal.user_name} berhasil disetujui!` });
      setTimeout(() => setAlertMessage(null), 4000);
      loadLeaves();
    } catch (err) {
      alert(err.message || 'Gagal menyetujui permohonan izin.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(true);
    try {
      await rejectLeave(rejectModal.id, rejectReason.trim());
      setRejectModal(null);
      setRejectReason('');
      setAlertMessage({ type: 'success', text: `Izin untuk ${rejectModal.user_name} telah ditolak.` });
      setTimeout(() => setAlertMessage(null), 4000);
      loadLeaves();
    } catch (err) {
      alert(err.message || 'Gagal menolak permohonan izin.');
    } finally {
      setActionLoading(false);
    }
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
                <FileCheck size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Persetujuan Izin Karyawan</h1>
                <p className="text-xs text-gray-500">Verifikasi, setujui atau tolak izin dengan melihat lampiran bukti</p>
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
        {/* Banner Alert Sukses */}
        {alertMessage && (
          <div className={`p-4 rounded-xl flex items-center gap-3 border shadow-xs transition-all ${
            alertMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}>
            <CheckCircle size={20} className="shrink-0 text-emerald-600" />
            <span className="text-sm font-medium">{alertMessage.text}</span>
          </div>
        )}

        {/* Controls Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Cari berdasarkan nama, NIP, atau alasan..."
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
                <option value="pending">Menunggu (Pending)</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
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
                  <th className="py-3.5 px-4 w-12 text-center">No</th>
                  <th className="py-3.5 px-4">Pegawai</th>
                  <th className="py-3.5 px-4">NIP</th>
                  <th className="py-3.5 px-4">Divisi</th>
                  <th className="py-3.5 px-4">Alasan & Keterangan</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4">Tanggal Pengajuan</th>
                  <th className="py-3.5 px-4 text-center">Lampiran</th>
                  <th className="py-3.5 px-4 text-center">Aksi / Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#1e5a8a] border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Memuat data permohonan izin...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText size={36} className="text-gray-300" />
                        <span className="text-sm font-medium text-gray-500">Tidak ada permohonan izin ditemukan</span>
                        <span className="text-xs text-gray-400">Cobalah mengubah filter pencarian atau tanggal</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLeaves.map((item, index) => {
                    const rowNumber = (currentPage - 1) * (pageSize === 'all' ? 0 : parseInt(pageSize, 10)) + index + 1;
                    const isPending = item.status === 'pending';

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3.5 px-4 text-center text-xs font-medium text-gray-500">
                          {rowNumber}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#1e5a8a]/10 text-[#1e5a8a] flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {(item.user_name || 'U').charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 truncate">{item.user_name || '-'}</p>
                              <p className="text-xs text-gray-500 truncate">{item.user_email || '-'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600">
                          {item.user_nip || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600">
                          <span className="px-2.5 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-700">
                            {item.divisi || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-gray-700 max-w-xs">
                          <p className="font-semibold text-gray-900">{item.reason}</p>
                          {item.description && (
                            <p className="text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                          )}
                          {item.reject_reason && item.status === 'rejected' && (
                            <div className="mt-1.5 p-2 bg-red-50 border border-red-100 rounded-lg text-red-700 text-[11px]">
                              <span className="font-semibold">Alasan Ditolak:</span> {item.reject_reason}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {getStatusBadge(item.status)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-gray-600 whitespace-nowrap">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.attachment ? (
                            <div className="flex items-center justify-center gap-2">
                              {isImageFile(item.attachment) && (
                                <img
                                  src={getImageUrl(item.attachment)}
                                  alt="Thumb"
                                  className="w-8 h-8 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shadow-xs"
                                  onClick={() => handleOpenAttachment(item)}
                                  title="Klik untuk memperbesar lampiran"
                                />
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenAttachment(item)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-[#1e5a8a] hover:bg-[#1e5a8a] hover:text-white border border-[#1e5a8a]/20 transition-all cursor-pointer shadow-xs group"
                                title="Lihat file lampiran"
                              >
                                <Paperclip size={13} className="group-hover:rotate-12 transition-transform" />
                                <span>Lihat File</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">Tidak Ada</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {isPending ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setConfirmApproveModal(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                                title="Setujui permohonan izin"
                              >
                                <CheckCircle size={14} />
                                <span>Setujui</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejectModal(item);
                                  setRejectReason('');
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                                title="Tolak permohonan izin"
                              >
                                <XCircle size={14} />
                                <span>Tolak</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">
                              Selesai ({item.reviewer_name ? `oleh ${item.reviewer_name}` : 'Admin'})
                            </span>
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
                Menampilkan <strong className="text-gray-700">{filteredLeaves.length}</strong> dari{' '}
                <strong className="text-gray-700">{totalCount}</strong> permohonan izin
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
                  disabled={filteredLeaves.length < parseInt(pageSize, 10)}
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

      {/* Modal Dialog Konfirmasi Approve */}
      {confirmApproveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !actionLoading && setConfirmApproveModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Setujui Permohonan Izin</h3>
                <p className="text-xs text-gray-500">Izin akan disetujui dan tercatat pada log absensi</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs text-gray-700 flex flex-col gap-1.5">
              <p><strong className="text-gray-900">Nama:</strong> {confirmApproveModal.user_name}</p>
              <p><strong className="text-gray-900">NIP:</strong> {confirmApproveModal.user_nip}</p>
              <p><strong className="text-gray-900">Alasan:</strong> {confirmApproveModal.reason}</p>
              {confirmApproveModal.description && (
                <p><strong className="text-gray-900">Keterangan:</strong> {confirmApproveModal.description}</p>
              )}
            </div>

            <p className="text-xs text-gray-600">
              Apakah Anda yakin ingin menyetujui izin ini? Tindakan ini akan mengesahkan izin karyawan untuk tanggal terkait.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmApproveModal(null)}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleApprove}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Memproses...' : 'Ya, Setujui Izin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Reject dengan Alasan */}
      {rejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => !actionLoading && setRejectModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100 p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <XCircle size={28} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Tolak Permohonan Izin</h3>
                <p className="text-xs text-gray-500">Berikan catatan alasan penolakan untuk karyawan</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs text-gray-700 flex flex-col gap-1.5">
              <p><strong className="text-gray-900">Nama:</strong> {rejectModal.user_name}</p>
              <p><strong className="text-gray-900">Alasan:</strong> {rejectModal.reason}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Alasan Penolakan <span className="text-gray-400 font-normal">(opsional)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Lampiran surat dokter belum jelas, kuota izin habis, dsb."
                rows={3}
                className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRejectModal(null)}
                className="px-4 py-2.5 text-xs font-medium rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleReject}
                className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Memproses...' : 'Tolak Permohonan'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <div className="mt-4 text-xs text-gray-600 bg-white px-4 py-2.5 rounded-xl border border-gray-200 w-full text-left flex flex-col gap-1">
                    <p><span className="font-semibold text-gray-700">Alasan:</span> {selectedAttachment.reason}</p>
                    {selectedAttachment.description && (
                      <p><span className="font-semibold text-gray-700">Keterangan:</span> {selectedAttachment.description}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <FileText size={48} className="text-[#1e5a8a]" />
                  <span className="text-sm font-semibold text-gray-800">Dokumen Lampiran</span>
                  <span className="text-xs text-gray-500 max-w-xs text-center truncate">
                    {selectedAttachment.rawPath?.split('/').pop() || 'Dokumen'}
                  </span>
                  <div className="mt-2 text-xs text-gray-600 bg-white px-4 py-2.5 rounded-xl border border-gray-200 w-full text-left flex flex-col gap-1">
                    <p><span className="font-semibold text-gray-700">Alasan:</span> {selectedAttachment.reason}</p>
                    {selectedAttachment.description && (
                      <p><span className="font-semibold text-gray-700">Keterangan:</span> {selectedAttachment.description}</p>
                    )}
                  </div>
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
