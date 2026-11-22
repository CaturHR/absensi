import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/attendance_service.dart';
import '../widgets/liquid_glass.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  TodayAttendanceStatus? _todayStatus;
  bool _isLoading = true;
  bool _isActionLoading = false;
  String _loadingMessage = 'Memproses...';

  @override
  void initState() {
    super.initState();
    _fetchTodayStatus();
  }

  Future<void> _fetchTodayStatus() async {
    try {
      final status = await AttendanceService.getTodayStatus();
      if (mounted) {
        setState(() {
          _todayStatus = status;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  /// Memperoleh lokasi GPS perangkat (Latitude & Longitude)
  Future<Position?> _determinePosition() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        // Layanan lokasi dinonaktifkan di perangkat
        debugPrint('GPS location services are disabled.');
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('GPS location permissions are denied');
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        debugPrint('GPS location permissions are permanently denied');
        return null;
      }

      // Ambil posisi terkini dengan timeout 8 detik
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 8),
      );
    } catch (e) {
      debugPrint('Error getting GPS location: $e');
      return null;
    }
  }

  Future<void> _handleAttendance(String type) async {
    final isClockIn = type == 'in';
    final actionName = isClockIn ? 'Clock In' : 'Clock Out';

    // Konfirmasi dialog sebelum submit
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(
              isClockIn ? Icons.login_rounded : Icons.logout_rounded,
              color: isClockIn ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
            ),
            const SizedBox(width: 10),
            Flexible(
              child: Text('Konfirmasi $actionName'),
            ),
          ],
        ),
        content: Text(
          isClockIn
              ? 'Apakah Anda ingin melakukan Clock In (Absen Masuk) sekarang? Lokasi GPS Anda akan dicatat otomatis.'
              : 'Apakah Anda ingin melakukan Clock Out (Absen Pulang) sekarang? Lokasi GPS Anda akan dicatat otomatis.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: isClockIn ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(actionName),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() {
      _isActionLoading = true;
      _loadingMessage = 'Mendapatkan lokasi GPS...';
    });

    try {
      // 1. Ambil koordinat GPS
      final position = await _determinePosition();

      if (mounted) {
        setState(() {
          _loadingMessage = 'Mengirim presensi ke server...';
        });
      }

      // 2. Kirim ke backend beserta koordinat lokasi
      final result = await AttendanceService.submitAttendance(
        type: type,
        latitude: position?.latitude,
        longitude: position?.longitude,
      );

      if (!mounted) return;

      setState(() => _isActionLoading = false);

      if (result.isSuccess) {
        // Tampilkan dialog berhasil
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 40),
                ),
                const SizedBox(height: 18),
                Text(
                  '$actionName Berhasil!',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  result.message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 13, color: Colors.black54),
                ),
                if (position != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.location_on, size: 14, color: Color(0xFF365C4A)),
                      const SizedBox(width: 4),
                      Text(
                        'GPS: ${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)}',
                        style: const TextStyle(fontSize: 11, color: Colors.black45),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF365C4A),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        );
        await _fetchTodayStatus();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result.message),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
        await _fetchTodayStatus();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isActionLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Terjadi kesalahan: $e'),
            backgroundColor: Colors.red.shade700,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool hasClockedIn = _todayStatus?.hasClockedIn ?? false;
    final bool hasClockedOut = _todayStatus?.hasClockedOut ?? false;
    final bool hasLeaveApproved = _todayStatus?.hasLeaveToday ?? false;
    final String? leaveStatus = _todayStatus?.leaveStatus;
    final bool isLeavePending = leaveStatus == 'pending';

    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: const LiquidGlassAppBar(
        title: 'Presensi Absensi',
        automaticallyImplyLeading: false,
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background Wallpaper
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
                  Colors.black.withValues(alpha: 0.25),
                  Colors.black.withValues(alpha: 0.10),
                  Colors.black.withValues(alpha: 0.35),
                ],
              ),
            ),
          ),

          SafeArea(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.white))
                : RefreshIndicator(
                    onRefresh: _fetchTodayStatus,
                    color: const Color(0xFF365C4A),
                    child: SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          const SizedBox(height: 12),

                          // Status Kehadiran Hari Ini
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.94),
                              borderRadius: BorderRadius.circular(24),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 16,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                              border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Row(
                                  children: [
                                    Icon(Icons.info_outline_rounded, size: 18, color: Color(0xFF365C4A)),
                                    SizedBox(width: 8),
                                    Text(
                                      'Status Presensi Hari Ini',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF1E293B),
                                      ),
                                    ),
                                  ],
                                ),
                                const Divider(height: 24, thickness: 1, color: Color(0xFFF1F5F9)),

                                if (hasLeaveApproved) ...[
                                  // Izin Disetujui
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFECFDF5),
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: const Color(0xFFA7F3D0)),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.assignment_turned_in, color: Color(0xFF059669)),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            'Izin Disetujui: ${_todayStatus?.leaveReason ?? "Izin"}. Anda tercatat izin untuk hari ini.',
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF065F46),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ] else if (isLeavePending) ...[
                                  // Izin Masih Menunggu Persetujuan Admin
                                  Container(
                                    padding: const EdgeInsets.all(12),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFEF3C7),
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: const Color(0xFFFDE68A)),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.pending_actions_rounded, color: Color(0xFFB45309)),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Text(
                                            'Izin Diajukan (${_todayStatus?.leaveReason ?? "Izin"}): Sedang menunggu persetujuan admin.',
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF92400E),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                ],

                                if (!hasLeaveApproved) ...[
                                  // Row Jam Masuk & Jam Pulang
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                          decoration: BoxDecoration(
                                            color: hasClockedIn ? const Color(0xFFECFDF5) : const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(16),
                                            border: Border.all(
                                              color: hasClockedIn ? const Color(0xFFA7F3D0) : const Color(0xFFE2E8F0),
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Icon(
                                                    Icons.login_rounded,
                                                    size: 16,
                                                    color: hasClockedIn ? const Color(0xFF059669) : Colors.grey,
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    'Clock In',
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                      color: hasClockedIn ? const Color(0xFF059669) : Colors.grey,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                hasClockedIn ? '${_todayStatus?.clockInTime ?? "-"} WIB' : '--:--',
                                                style: TextStyle(
                                                  fontSize: 17,
                                                  fontWeight: FontWeight.bold,
                                                  color: hasClockedIn ? const Color(0xFF065F46) : Colors.grey.shade400,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                          decoration: BoxDecoration(
                                            color: hasClockedOut ? const Color(0xFFEFF6FF) : const Color(0xFFF8FAFC),
                                            borderRadius: BorderRadius.circular(16),
                                            border: Border.all(
                                              color: hasClockedOut ? const Color(0xFFBFDBFE) : const Color(0xFFE2E8F0),
                                            ),
                                          ),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Row(
                                                children: [
                                                  Icon(
                                                    Icons.logout_rounded,
                                                    size: 16,
                                                    color: hasClockedOut ? const Color(0xFF2563EB) : Colors.grey,
                                                  ),
                                                  const SizedBox(width: 6),
                                                  Text(
                                                    'Clock Out',
                                                    style: TextStyle(
                                                      fontSize: 12,
                                                      fontWeight: FontWeight.w600,
                                                      color: hasClockedOut ? const Color(0xFF2563EB) : Colors.grey,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              const SizedBox(height: 6),
                                              Text(
                                                hasClockedOut ? '${_todayStatus?.clockOutTime ?? "-"} WIB' : '--:--',
                                                style: TextStyle(
                                                  fontSize: 17,
                                                  fontWeight: FontWeight.bold,
                                                  color: hasClockedOut ? const Color(0xFF1E40AF) : Colors.grey.shade400,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ],
                            ),
                          ),

                          const SizedBox(height: 28),

                          // ──────────────────────────────────────────────
                          // Tombol Clock In & Clock Out
                          // ──────────────────────────────────────────────
                          if (!hasLeaveApproved) ...[
                            // Tombol 1: CLOCK IN
                            SizedBox(
                              width: double.infinity,
                              height: 62,
                              child: ElevatedButton(
                                onPressed: (_isActionLoading || hasClockedIn) ? null : () => _handleAttendance('in'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF10B981),
                                  disabledBackgroundColor: hasClockedIn ? const Color(0xFFD1FAE5) : Colors.grey.shade300,
                                  foregroundColor: Colors.white,
                                  disabledForegroundColor: hasClockedIn ? const Color(0xFF059669) : Colors.grey.shade500,
                                  elevation: hasClockedIn ? 0 : 4,
                                  shadowColor: const Color(0xFF10B981).withValues(alpha: 0.4),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                ),
                                child: _isActionLoading
                                    ? Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          const SizedBox(
                                            width: 22,
                                            height: 22,
                                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                          ),
                                          const SizedBox(width: 12),
                                          Text(
                                            _loadingMessage,
                                            style: const TextStyle(fontSize: 14, color: Colors.white),
                                          ),
                                        ],
                                      )
                                    : Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            hasClockedIn ? Icons.check_circle_rounded : Icons.login_rounded,
                                            size: 24,
                                          ),
                                          const SizedBox(width: 12),
                                          Text(
                                            hasClockedIn ? 'Sudah Clock In' : 'Clock In (Masuk)',
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 0.2,
                                            ),
                                          ),
                                        ],
                                      ),
                              ),
                            ),

                            const SizedBox(height: 16),

                            // Tombol 2: CLOCK OUT
                            SizedBox(
                              width: double.infinity,
                              height: 62,
                              child: ElevatedButton(
                                onPressed: (_isActionLoading || !hasClockedIn || hasClockedOut)
                                    ? null
                                    : () => _handleAttendance('out'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF2563EB),
                                  disabledBackgroundColor: hasClockedOut ? const Color(0xFFDBEAFE) : Colors.grey.shade300,
                                  foregroundColor: Colors.white,
                                  disabledForegroundColor: hasClockedOut ? const Color(0xFF1D4ED8) : Colors.grey.shade500,
                                  elevation: (!hasClockedIn || hasClockedOut) ? 0 : 4,
                                  shadowColor: const Color(0xFF2563EB).withValues(alpha: 0.4),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                ),
                                child: _isActionLoading
                                    ? Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          const SizedBox(
                                            width: 22,
                                            height: 22,
                                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                          ),
                                          const SizedBox(width: 12),
                                          Text(
                                            _loadingMessage,
                                            style: const TextStyle(fontSize: 14, color: Colors.white),
                                          ),
                                        ],
                                      )
                                    : Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            hasClockedOut ? Icons.check_circle_rounded : Icons.logout_rounded,
                                            size: 24,
                                          ),
                                          const SizedBox(width: 12),
                                          Text(
                                            hasClockedOut
                                                ? 'Sudah Clock Out'
                                                : !hasClockedIn
                                                    ? 'Clock Out (Harus Clock In Dulu)'
                                                    : 'Clock Out (Pulang)',
                                            style: const TextStyle(
                                              fontSize: 16,
                                              fontWeight: FontWeight.bold,
                                              letterSpacing: 0.2,
                                            ),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ],

                          const SizedBox(height: 100),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
