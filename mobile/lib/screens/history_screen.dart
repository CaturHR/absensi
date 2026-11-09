import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/attendance_service.dart';
import '../widgets/liquid_glass.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<Map<String, dynamic>> _historyList = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchHistory();
  }

  Future<void> _fetchHistory() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final list = await AttendanceService.getMyHistory();
      if (mounted) {
        setState(() {
          _historyList = list;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  Widget _buildStatusBadge(String status, [String? notes]) {
    Color bg;
    Color text;
    IconData icon;

    final s = status.trim().toLowerCase();
    final isNoteIzin = (notes ?? '').trim().toLowerCase().startsWith('izin');

    if (s == 'izin' || s.contains('izin') || isNoteIzin) {
      bg = const Color(0xFFFEF3C7);
      text = const Color(0xFFB45309);
      icon = Icons.assignment_turned_in_rounded;
      status = 'Izin';
    } else if (s == 'clock in' || s == 'in' || s.startsWith('clock in')) {
      bg = const Color(0xFFDCFCE7);
      text = const Color(0xFF15803D);
      icon = Icons.login_rounded;
    } else if (s == 'clock out' || s == 'out' || s.startsWith('clock out')) {
      bg = const Color(0xFFDBEAFE);
      text = const Color(0xFF1D4ED8);
      icon = Icons.logout_rounded;
    } else {
      bg = const Color(0xFFF1F5F9);
      text = const Color(0xFF475569);
      icon = Icons.check_circle_outline;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: text, size: 14),
          const SizedBox(width: 5),
          Text(
            status,
            style: TextStyle(color: text, fontSize: 11, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: LiquidGlassAppBar(
        title: 'Riwayat Presensi',
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchHistory,
            tooltip: 'Muat Ulang',
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            'lib/asset/baground/BG.png',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(color: const Color(0xFF365C4A)),
          ),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.20),
                  Colors.black.withValues(alpha: 0.08),
                  Colors.black.withValues(alpha: 0.30),
                ],
              ),
            ),
          ),
          SafeArea(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.white))
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.cloud_off, size: 48, color: Colors.white70),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 13, color: Colors.white),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _fetchHistory,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF365C4A),
                                  foregroundColor: Colors.white,
                                ),
                                child: const Text('Coba Lagi'),
                              ),
                            ],
                          ),
                        ),
                      )
                    : _historyList.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.event_busy_outlined, size: 48, color: Colors.white60),
                                SizedBox(height: 12),
                                Text(
                                  'Belum ada catatan riwayat absensi.',
                                  style: TextStyle(color: Colors.white),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _fetchHistory,
                            color: const Color(0xFF365C4A),
                            child: ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                              itemCount: _historyList.length,
                              separatorBuilder: (context, index) => const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final item = _historyList[index];
                                final createdAt = item['created_at'] != null
                                    ? DateTime.tryParse(item['created_at'])?.toLocal()
                                    : null;

                                final dateStr = createdAt != null
                                    ? DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(createdAt)
                                    : '-';
                                final timeStr = createdAt != null
                                    ? DateFormat('HH:mm').format(createdAt)
                                    : '-';

                                final status = item['status']?.toString() ?? 'Clock In';
                                final notes = item['notes']?.toString();
                                final s = status.trim().toLowerCase();
                                final isIzin = s == 'izin' || s.contains('izin') || (notes != null && notes.trim().toLowerCase().startsWith('izin'));
                                final isClockIn = !isIzin && (s == 'clock in' || s == 'in' || s.startsWith('clock in'));

                                return Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.94),
                                    borderRadius: BorderRadius.circular(18),
                                    boxShadow: [
                                      BoxShadow(
                                        color: Colors.black.withValues(alpha: 0.05),
                                        blurRadius: 10,
                                        offset: const Offset(0, 3),
                                      ),
                                    ],
                                    border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
                                  ),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 44,
                                        height: 44,
                                        decoration: BoxDecoration(
                                          color: isClockIn
                                              ? const Color(0xFFDCFCE7)
                                              : (isIzin ? const Color(0xFFFEF3C7) : const Color(0xFFDBEAFE)),
                                          shape: BoxShape.circle,
                                        ),
                                        child: Icon(
                                          isClockIn
                                              ? Icons.login_rounded
                                              : (isIzin ? Icons.assignment_turned_in_rounded : Icons.logout_rounded),
                                          color: isClockIn
                                              ? const Color(0xFF15803D)
                                              : (isIzin ? const Color(0xFFB45309) : const Color(0xFF1D4ED8)),
                                          size: 22,
                                        ),
                                      ),
                                      const SizedBox(width: 14),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              dateStr,
                                              style: const TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.bold,
                                                color: Color(0xFF1E293B),
                                              ),
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              'Pukul $timeStr WIB',
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: Colors.black54,
                                              ),
                                            ),
                                            if (notes != null && notes.trim().isNotEmpty) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                notes.trim(),
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: Color(0xFF64748B),
                                                  fontStyle: FontStyle.italic,
                                                ),
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                      _buildStatusBadge(status, notes),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
