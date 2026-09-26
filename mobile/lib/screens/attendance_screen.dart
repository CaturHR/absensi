import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import '../services/attendance_service.dart';
import '../services/location_service.dart';

class AttendanceScreen extends StatefulWidget {
  final List<CameraDescription> cameras;

  const AttendanceScreen({super.key, required this.cameras});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> with WidgetsBindingObserver {
  CameraController? _cameraController;
  bool _isCameraInitialized = false;
  bool _isCameraLoading = true;
  String? _cameraErrorMessage;
  bool _isLoading = false;
  String _loadingMessage = '';
  Position? _currentPosition;
  OfficeLocation? _officeLocation;
  TodayAttendanceStatus? _todayStatus;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initFrontCamera();
    _fetchQuickLocation();
    _fetchOfficeLocation();
    _fetchTodayStatus();
  }

  /// Ambil status absensi hari ini (apakah sudah Clock In / Clock Out)
  Future<void> _fetchTodayStatus() async {
    try {
      final status = await AttendanceService.getTodayStatus();
      if (mounted) {
        setState(() {
          _todayStatus = status;
        });
      }
    } catch (_) {}
  }

  Future<void> _fetchOfficeLocation() async {
    final office = await AttendanceService.getActiveOfficeLocation();
    if (mounted) {
      setState(() => _officeLocation = office);
    }
  }

  double? get _distanceToOffice {
    if (_currentPosition == null || _officeLocation == null) return null;
    return Geolocator.distanceBetween(
      _currentPosition!.latitude,
      _currentPosition!.longitude,
      _officeLocation!.latitude,
      _officeLocation!.longitude,
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cameraController?.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final CameraController? cameraController = _cameraController;

    if (cameraController == null || !cameraController.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      cameraController.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initFrontCamera();
    }
  }

  /// Inisialisasi kamera depan untuk selfie presensi real-time
  Future<void> _initFrontCamera() async {
    if (mounted) {
      setState(() {
        _isCameraLoading = true;
        _cameraErrorMessage = null;
      });
    }

    List<CameraDescription> cams = widget.cameras;

    // Jika daftar kamera kosong dari startup, coba deteksi ulang
    if (cams.isEmpty) {
      try {
        cams = await availableCameras();
      } catch (e) {
        debugPrint('availableCameras error: $e');
        if (mounted) {
          setState(() {
            _isCameraLoading = false;
            _cameraErrorMessage = 'Kamera tidak dapat dibaca. Pastikan izin kamera aktif dan tidak sedang digunakan oleh aplikasi lain.';
          });
        }
        return;
      }
    }

    if (cams.isEmpty) {
      if (mounted) {
        setState(() {
          _isCameraLoading = false;
          _cameraErrorMessage = 'Tidak ada perangkat kamera yang terdeteksi di perangkat Anda.';
        });
      }
      return;
    }

    // Cari kamera depan atau kamera pertama yang tersedia
    final frontCamera = cams.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
      orElse: () => cams.first,
    );

    final controller = CameraController(
      frontCamera,
      ResolutionPreset.medium,
      enableAudio: false,
      imageFormatGroup: ImageFormatGroup.jpeg,
    );

    try {
      await controller.initialize();
      if (!mounted) return;
      setState(() {
        _cameraController = controller;
        _isCameraInitialized = true;
        _isCameraLoading = false;
        _cameraErrorMessage = null;
      });
    } catch (e) {
      debugPrint('Error initializing camera: $e');
      if (mounted) {
        setState(() {
          _isCameraLoading = false;
          _cameraErrorMessage = 'Gagal mengakses kamera: $e.\n\nTips: Tutup aplikasi lain yang sedang memakai webcam lalu klik Coba Lagi.';
        });
      }
    }
  }

  /// Pre-fetch lokasi GPS pengguna di latar belakang
  Future<void> _fetchQuickLocation() async {
    try {
      final pos = await LocationService.getCurrentPosition();
      if (mounted) setState(() => _currentPosition = pos);
    } catch (_) {}
  }

  /// Alur Utama Presensi (Clock In / Clock Out):
  /// 1. Verifikasi kamera siap
  /// 2. Ambil foto wajah secara real-time
  /// 3. Ambil koordinat GPS akurat & validasi anti Fake-GPS
  /// 4. Kirim ke backend dengan type 'in' atau 'out'
  /// 5. Tampilkan pop up hasil presensi pada jam sekian
  /// 6. Perbarui state tombol harian
  Future<void> _handleTakeAttendance({required String type}) async {
    final isClockIn = type == 'in';
    final actionLabel = isClockIn ? 'Clock In' : 'Clock Out';

    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kamera belum siap, mohon tunggu sebentar.')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _loadingMessage = 'Mengambil foto wajah real-time...';
    });

    try {
      // ──────────────────────────────────────────────
      // 1. Ambil foto wajah secara real-time
      // ──────────────────────────────────────────────
      final XFile image = await _cameraController!.takePicture();

      // ──────────────────────────────────────────────
      // 2. Ambil koordinat GPS akurat & validasi Anti-Fake GPS
      // ──────────────────────────────────────────────
      setState(() {
        _loadingMessage = 'Mendeteksi koordinat GPS akurat...';
      });

      final Position position = await LocationService.getCurrentPosition();
      setState(() => _currentPosition = position);

      // ──────────────────────────────────────────────
      // 3. Kirim multipart request ke backend
      // ──────────────────────────────────────────────
      setState(() {
        _loadingMessage = 'Memverifikasi wajah & lokasi di server...';
      });

      final result = await AttendanceService.submitAttendance(
        photoFile: image,
        latitude: position.latitude,
        longitude: position.longitude,
        type: type,
      );

      // Refresh status absensi hari ini dari server
      await _fetchTodayStatus();

      // ──────────────────────────────────────────────
      // 4. Tampilkan pop up hasil presensi
      // ──────────────────────────────────────────────
      if (mounted) {
        _showAttendanceResultDialog(result, type);
      }
    } on MockLocationDetectedException catch (mockError) {
      if (mounted) {
        _showErrorDialog(
          title: 'Lokasi Palsu Terdeteksi!',
          message: mockError.message,
          icon: Icons.security,
          color: Colors.red,
        );
      }
    } catch (e) {
      if (mounted) {
        _showErrorDialog(
          title: '$actionLabel Gagal',
          message: e.toString().replaceAll('Exception: ', ''),
          icon: Icons.error_outline,
          color: Colors.orange,
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _loadingMessage = '';
        });
      }
    }
  }

  /// Pop-up Dialog Hasil Presensi Sesuai Permintaan
  void _showAttendanceResultDialog(AttendanceResult result, String type) {
    final isPresent = result.status == 'Clock In' || result.status == 'Clock Out' || result.isSuccess;
    final isOutOfRadius = result.status == 'Di Luar Radius';
    final isClockIn = type == 'in';
    final actionLabel = isClockIn ? 'Clock In' : 'Clock Out';

    // Waktu jam saat ini / jam dari response
    final displayTime = result.time ?? DateFormat('HH:mm').format(DateTime.now());

    Color primaryColor = isPresent
        ? const Color(0xFF10B981) // Emerald Green
        : isOutOfRadius
            ? const Color(0xFFEF4444)
            : const Color(0xFFF59E0B);

    IconData statusIcon = isPresent
        ? Icons.check_circle_rounded
        : isOutOfRadius
            ? Icons.location_off_rounded
            : Icons.face_retouching_off_rounded;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Lingkaran Icon Status
              Container(
                width: 76,
                height: 76,
                decoration: BoxDecoration(
                  color: primaryColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(statusIcon, color: primaryColor, size: 44),
              ),
              const SizedBox(height: 16),

              // Judul Pop Up
              Text(
                isPresent ? '$actionLabel Berhasil!' : '$actionLabel Gagal',
                style: TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.bold,
                  color: isPresent ? const Color(0xFF0F172A) : primaryColor,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),

              // Pesan Waktu Presensi: "Clock In berhasil pada jam 08:30"
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: isPresent
                      ? const Color(0xFF10B981).withValues(alpha: 0.08)
                      : Colors.red.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.access_time_filled_rounded,
                      size: 18,
                      color: isPresent ? const Color(0xFF10B981) : Colors.red,
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        isPresent
                            ? '$actionLabel berhasil pada jam $displayTime'
                            : result.message,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: isPresent ? const Color(0xFF065F46) : Colors.red.shade800,
                        ),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Kartu Detail
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  children: [
                    _buildPopupDetailRow(
                      icon: Icons.calendar_today_rounded,
                      label: 'Tanggal',
                      value: DateFormat('EEEE, d MMM yyyy', 'id_ID').format(DateTime.now()),
                    ),
                    const Divider(height: 16, color: Color(0xFFE2E8F0)),
                    _buildPopupDetailRow(
                      icon: Icons.verified_user_rounded,
                      label: 'Status',
                      value: result.status,
                      valueColor: primaryColor,
                    ),
                    if (result.locationName != null) ...[
                      const Divider(height: 16, color: Color(0xFFE2E8F0)),
                      _buildPopupDetailRow(
                        icon: Icons.business_rounded,
                        label: 'Lokasi',
                        value: result.locationName!,
                      ),
                    ],
                    if (result.distance != null) ...[
                      const Divider(height: 16, color: Color(0xFFE2E8F0)),
                      _buildPopupDetailRow(
                        icon: Icons.near_me_rounded,
                        label: 'Jarak GPS',
                        value: '${result.distance!.toStringAsFixed(0)} meter',
                      ),
                    ],
                    if (result.faceConfidence != null) ...[
                      const Divider(height: 16, color: Color(0xFFE2E8F0)),
                      _buildPopupDetailRow(
                        icon: Icons.face_rounded,
                        label: 'Kecocokan Wajah',
                        value: '${result.faceConfidence!.toStringAsFixed(1)}%',
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
          actions: [
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: ElevatedButton.styleFrom(
                  backgroundColor: primaryColor,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  elevation: 0,
                ),
                child: const Text('Mengerti', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildPopupDetailRow({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.blueGrey),
        const SizedBox(width: 8),
        Text(label, style: const TextStyle(fontSize: 12, color: Colors.black54)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: valueColor ?? const Color(0xFF0F172A),
            ),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
        ),
      ],
    );
  }

  void _showErrorDialog({
    required String title,
    required String message,
    required IconData icon,
    required Color color,
  }) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(icon, color: color),
            const SizedBox(width: 8),
            Expanded(child: Text(title, style: const TextStyle(fontSize: 16))),
          ],
        ),
        content: Text(message, style: const TextStyle(fontSize: 13, color: Colors.black87)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasClockedIn = _todayStatus?.hasClockedIn ?? false;
    final hasClockedOut = _todayStatus?.hasClockedOut ?? false;

    // Alur logika tombol sesuai permintaan user:
    // 1. Belum Clock In:
    //    - Tombol Clock In: Aktif (Hijau)
    //    - Tombol Clock Out: Abu-abu (tidak bisa dipencet)
    // 2. Sudah Clock In, belum Clock Out:
    //    - Tombol Clock In: Abu-abu (tidak bisa dipencet)
    //    - Tombol Clock Out: Aktif (Bisa dipencet)
    // 3. Sudah Clock Out:
    //    - Keduanya abu-abu (1x per hari)
    final bool canClockIn = !hasClockedIn && !_isLoading;
    final bool canClockOut = hasClockedIn && !hasClockedOut && !_isLoading;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Presensi Wajah & GPS', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            tooltip: 'Perbarui Status',
            onPressed: () {
              _fetchTodayStatus();
              _fetchQuickLocation();
            },
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background placeholder dari lib/asset/baground/BG.png saat kamera belum aktif
          if (!_isCameraInitialized) ...[
            Image.asset(
              'lib/asset/baground/BG.png',
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => const SizedBox(),
            ),
            Container(
              color: Colors.black.withValues(alpha: 0.65),
            ),
          ],

          // 1. Viewfinder Kamera Depan Real-Time
          if (_isCameraInitialized && _cameraController != null)
            Center(
              child: AspectRatio(
                aspectRatio: 1 / _cameraController!.value.aspectRatio,
                child: CameraPreview(_cameraController!),
              ),
            )
          else if (_cameraErrorMessage != null)
            Center(
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 36),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.amberAccent.withValues(alpha: 0.4)),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.videocam_off_rounded, color: Colors.amberAccent, size: 48),
                    const SizedBox(height: 12),
                    const Text(
                      'Kamera Belum Terhubung',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _cameraErrorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _initFrontCamera,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                      ),
                      icon: const Icon(Icons.refresh, size: 18),
                      label: const Text('Coba Sambungkan Lagi', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            )
          else
            Center(
              child: _isCameraLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const SizedBox.shrink(),
            ),

          // 2. Oval Face Guide Overlay (Frame Wajah Real-Time)
          CustomPaint(
            painter: OvalHoleOverlayPainter(),
            child: Container(),
          ),

          // 3. Top Info Pill: Status Lokasi GPS & Geofencing Office Proximity
          Positioned(
            top: 16,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white24),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        _currentPosition != null ? Icons.my_location : Icons.location_searching,
                        color: _currentPosition != null ? Colors.greenAccent : Colors.orangeAccent,
                        size: 15,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _currentPosition != null
                              ? 'GPS: ${_currentPosition!.latitude.toStringAsFixed(5)}, ${_currentPosition!.longitude.toStringAsFixed(5)}'
                              : 'Mencari sinyal GPS akurat...',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontFamily: 'monospace'),
                          textAlign: TextAlign.center,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                  if (_officeLocation != null && _currentPosition != null && _distanceToOffice != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _distanceToOffice! <= _officeLocation!.radius
                              ? Icons.check_circle_outline
                              : Icons.warning_amber_rounded,
                          color: _distanceToOffice! <= _officeLocation!.radius
                              ? Colors.greenAccent
                              : Colors.amberAccent,
                          size: 14,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            '${_officeLocation!.name}: ${_distanceToOffice!.toStringAsFixed(0)}m / ${_officeLocation!.radius}m (${_distanceToOffice! <= _officeLocation!.radius ? "Dalam Radius" : "Di Luar Radius"})',
                            style: TextStyle(
                              color: _distanceToOffice! <= _officeLocation!.radius
                                  ? Colors.greenAccent
                                  : Colors.amberAccent,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),

          // 4. Instructions Guide Text
          Positioned(
            bottom: 140,
            left: 24,
            right: 24,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.65),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white12),
                ),
                child: const Text(
                  'Posisikan wajah Anda tepat di dalam bingkai oval',
                  style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          ),

          // 5. Bottom Action: Pilihan "Clock In" dan "Clock Out"
          Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A).withValues(alpha: 0.92),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.5),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Status Info Hari Ini (Ringkasan 1x per hari)
                  if (hasClockedIn && hasClockedOut)
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.task_alt_rounded, color: Color(0xFF10B981), size: 16),
                          SizedBox(width: 6),
                          Text(
                            'Presensi hari ini sudah lengkap (Clock In & Out selesai)',
                            style: TextStyle(color: Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),

                  Row(
                    children: [
                      // ─── TOMBOL CLOCK IN (Absen Masuk) ───
                      Expanded(
                        child: _buildAttendanceButton(
                          title: 'Clock In',
                          subtitle: hasClockedIn
                              ? 'Pukul ${_todayStatus?.clockInTime ?? "Selesai"}'
                              : 'Absen Masuk',
                          icon: hasClockedIn ? Icons.check_circle_rounded : Icons.login_rounded,
                          isEnabled: canClockIn,
                          activeColor: const Color(0xFF10B981), // Emerald Green
                          onPressed: canClockIn
                              ? () => _handleTakeAttendance(type: 'in')
                              : null,
                        ),
                      ),
                      const SizedBox(width: 12),

                      // ─── TOMBOL CLOCK OUT (Absen Keluar) ───
                      Expanded(
                        child: _buildAttendanceButton(
                          title: 'Clock Out',
                          subtitle: hasClockedOut
                              ? 'Pukul ${_todayStatus?.clockOutTime ?? "Selesai"}'
                              : (hasClockedIn ? 'Absen Keluar' : 'Belum Clock In'),
                          icon: hasClockedOut ? Icons.check_circle_rounded : Icons.logout_rounded,
                          isEnabled: canClockOut,
                          activeColor: const Color(0xFFF97316), // Vibrant Orange
                          onPressed: canClockOut
                              ? () => _handleTakeAttendance(type: 'out')
                              : null,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // 6. Loading Modal Overlay saat proses berlangsung
          if (_isLoading)
            Container(
              color: Colors.black.withValues(alpha: 0.8),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(24),
                  margin: const EdgeInsets.symmetric(horizontal: 40),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: Color(0xFF365C4A)),
                      const SizedBox(height: 18),
                      Text(
                        _loadingMessage.isNotEmpty ? _loadingMessage : 'Memproses presensi...',
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  /// Helper Widget Pembuat Tombol Clock In & Clock Out
  Widget _buildAttendanceButton({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isEnabled,
    required Color activeColor,
    required VoidCallback? onPressed,
  }) {
    final Color bgColor = isEnabled ? activeColor : const Color(0xFF334155);
    final Color textColor = isEnabled ? Colors.white : Colors.white38;
    final Color iconColor = isEnabled ? Colors.white : Colors.white38;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isEnabled ? onPressed : null,
        borderRadius: BorderRadius.circular(16),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isEnabled ? Colors.white24 : Colors.transparent,
              width: 1,
            ),
            boxShadow: isEnabled
                ? [
                    BoxShadow(
                      color: activeColor.withValues(alpha: 0.4),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : [],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: iconColor, size: 26),
              const SizedBox(height: 6),
              Text(
                title,
                style: TextStyle(
                  color: textColor,
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(
                  color: isEnabled ? Colors.white.withValues(alpha: 0.85) : Colors.white30,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Custom Painter untuk membuat overlay gelap dengan lubang oval di tengah
class OvalHoleOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final backgroundPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.5)
      ..style = PaintingStyle.fill;

    final ovalWidth = size.width * 0.72;
    final ovalHeight = size.height * 0.46;
    final ovalRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.42),
      width: ovalWidth,
      height: ovalHeight,
    );

    final backgroundPath = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final ovalPath = Path()..addOval(ovalRect);
    final combinedPath = Path.combine(PathOperation.difference, backgroundPath, ovalPath);

    canvas.drawPath(combinedPath, backgroundPaint);

    final borderPaint = Paint()
      ..color = const Color(0xFF10B981) // Emerald Green border
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0;

    canvas.drawOval(ovalRect, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
