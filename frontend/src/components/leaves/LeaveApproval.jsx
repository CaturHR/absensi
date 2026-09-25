import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  Paperclip,
  RefreshCw,
  AlertTriangle,
  Search,
  Filter,
} from 'lucide-react';
import { fetchLeaveRequests, approveLeave, rejectLeave } from '../../services/api';

export default function LeaveApproval() {
  const [leaves, setLeaves] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLeaves();
  }, [filterStatus]);

  async function loadLeaves() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchLeaveRequests({ status: filterStatus });
      if (result.success) {
        setLeaves(result.data || []);
      } else {
        setError('Gagal memuat data permohonan izin.');
      }
    } catch (err) {
      setError('Gagal memuat data permohonan izin: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleApprove(id) {
    if (actionLoading) return;
    setActionLoading(id);
    try {
      const result = await approveLeave(id);
      if (result.success) {
        loadLeaves();
      } else {
        alert(result.message || 'Gagal menyetujui izin.');
      }
    } catch (err) {
      alert('Gagal menyetujui izin: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(id) {
    if (actionLoading) return;
    const confirm = window.confirm('Apakah Anda yakin ingin menolak permohonan izin ini?');
    if (!confirm) return;

    setActionLoading(id);
    try {
      const result = await rejectLeave(id);
      if (result.success) {
        loadLeaves();
      } else {
        alert(result.message || 'Gagal menolak izin.');
      }
    } catch (err) {
      alert('Gagal menolak izin: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  function getStatusBadge(status) {
    const config = {
      pending: {
        label: 'Menunggu',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: Clock,
      },
      approved: {
        label: 'Disetujui',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: CheckCircle2,
      },
      rejected: {
        label: 'Ditolak',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        icon: XCircle,
      },
    };
    const c = config[status] || config.pending;
    const Icon = c.icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${c.bg} ${c.text} ${c.border}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {c.label}
      </span>
    );
  }

  // Filter by search
  const filteredLeaves = leaves.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.user_name || '').toLowerCase().includes(q) ||
      (l.user_nip || '').toLowerCase().includes(q) ||
      (l.reason || '').toLowerCase().includes(q) ||
      (l.description || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">
            Approval Permohonan Izin
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Kelola dan tinjau semua permohonan izin karyawan
          </p>
        </div>
        <button
          onClick={loadLeaves}
          className="inline-flex items-center gap-2 px-4 py-2 bg-moss text-white rounded-xl text-sm font-semibold hover:bg-moss/90 transition-colors shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Muat Ulang
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, NIP, atau alasan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moss/30 focus:border-moss transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === status
                  ? 'bg-moss text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {status === 'all'
                ? 'Semua'
                : status === 'pending'
                ? 'Menunggu'
                : status === 'approved'
                ? 'Disetujui'
                : 'Ditolak'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-moss border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-sm text-slate-500">Memuat data izin...</span>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <p className="text-sm text-rose-700 font-medium">{error}</p>
          <button
            onClick={loadLeaves}
            className="mt-3 text-sm text-rose-600 underline hover:no-underline"
          >
            Coba Lagi
          </button>
        </div>
      ) : filteredLeaves.length === 0 ? (
        <div className="bg-white/80 border border-slate-200 rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">
            {searchQuery ? 'Tidak ada hasil ditemukan.' : 'Belum ada permohonan izin.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLeaves.map((leave) => (
            <div
              key={leave.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:shadow-md transition-all duration-200"
            >
              {/* Top Row: User Info + Status */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-moss/15 flex items-center justify-center text-moss font-bold text-sm border border-moss/20">
                    {(leave.user_name || 'K').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {leave.user_name || 'Karyawan'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      NIP: {leave.user_nip || '-'}
                    </p>
                  </div>
                </div>
                {getStatusBadge(leave.status)}
              </div>

              {/* Detail Cards */}
              <div className="bg-slate-50/80 rounded-xl p-4 space-y-3 border border-slate-100">
                {/* Alasan */}
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                      Alasan
                    </p>
                    <p className="text-sm text-slate-700 font-medium mt-0.5">
                      {leave.reason || '-'}
                    </p>
                  </div>
                </div>

                {/* Keterangan */}
                {leave.description && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                        Keterangan
                      </p>
                      <p className="text-sm text-slate-600 mt-0.5">{leave.description}</p>
                    </div>
                  </div>
                )}

                {/* Lampiran */}
                {leave.attachment && (
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                        Lampiran
                      </p>
                      <a
                        href={`/${leave.attachment}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-indigo-600 hover:underline font-medium"
                      >
                        Lihat File Lampiran
                      </a>
                    </div>
                  </div>
                )}

                {/* Tanggal */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                      Diajukan
                    </p>
                    <p className="text-xs text-slate-600 font-mono mt-0.5">
                      {formatDate(leave.created_at)}
                    </p>
                  </div>
                </div>

                {/* Reviewer */}
                {leave.reviewer_name && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                        Ditinjau Oleh
                      </p>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        {leave.reviewer_name} · {formatDate(leave.reviewed_at)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons (only for pending) */}
              {leave.status === 'pending' && (
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleApprove(leave.id)}
                    disabled={actionLoading === leave.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {actionLoading === leave.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(leave.id)}
                    disabled={actionLoading === leave.id}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-bold hover:bg-rose-600 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {actionLoading === leave.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Tolak
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
