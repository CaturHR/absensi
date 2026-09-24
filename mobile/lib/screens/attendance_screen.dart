import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initFrontCamera();
    _fetchQuickLocation();
    _fetchOfficeLocation();
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

    // App state changed before camera initialization
    if (cameraController == null || !cameraController.value.isInitialized) {
      return;
    }

    if (state == AppLifecycleState.inactive) {
      cameraController.dispose();
    } else if (state == AppLifecycleState.resumed) {
      _initFrontCamera();
    }
  }

  /// Inisialisasi kamera depan untuk selfie presensi
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
            _cameraErrorMessage = 'Kamera tidak dapat dibaca. Pastikan izin kamera aktif dan tidak sedang digunakan oleh aplikasi lain (Zoom, Teams, Camera App).';
          });
        }
        return;
      }
    }

    if (cams.isEmpty) {
      if (mounted) {
        setState(() {
          _isCameraLoading = false;
          _cameraErrorMessage = 'Tidak ada perangkat kamera yang terdeteksi di komputer/HP Anda.';
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
          _cameraErrorMessage = 'Gagal mengakses kamera: $e.\n\nTips: Tutup aplikasi lain yang sedang memakai webcam (Camera Windows, Zoom, Meet, dsb.) lalu klik Coba Lagi.';
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

  /// Alur Utama Presensi:
  /// 1. Ambil foto wajah dari kamera depan
  /// 2. Ambil koordinat GPS akurat & cek anti Fake-GPS (isMocked)
  /// 3. Kirim multipart request ke server Express.js
  /// 4. Tampilkan dialog status hasil absensi
  Future<void> _handleTakeAttendance() async {
    if (_cameraController == null || !_cameraController!.value.isInitialized) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Kamera belum siap, mohon tunggu sebentar.')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _loadingMessage = 'Mengambil foto wajah...';
    });

    try {
      // ──────────────────────────────────────────────
      // Langkah 1: Ambil foto wajah dari kamera
      // ──────────────────────────────────────────────
      final XFile image = await _cameraController!.takePicture();

      // ──────────────────────────────────────────────
      // Langkah 2: Ambil koordinat GPS & Validasi Anti Fake-GPS
      // ──────────────────────────────────────────────
      setState(() {
        _loadingMessage = 'Mendeteksi koordinat GPS akurat...';
      });

      final Position position = await LocationService.getCurrentPosition();
      setState(() => _currentPosition = position);

      // ──────────────────────────────────────────────
      // Langkah 3: Kirim multipart ke backend Express.js
      // ──────────────────────────────────────────────
      setState(() {
        _loadingMessage = 'Memverifikasi wajah & geofencing di server...';
      });

      final result = await AttendanceService.submitAttendance(
        photoFile: image,
        latitude: position.latitude,
        longitude: position.longitude,
      );

      // ──────────────────────────────────────────────
      // Langkah 4: Tampilkan dialog hasil presensi
      // ──────────────────────────────────────────────
      if (mounted) {
        _showAttendanceResultDialog(result);
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
          title: 'Presensi Gagal',
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

  /// Dialog hasil presensi (Hadir / Di Luar Radius / Wajah Tidak Cocok)
  void _showAttendanceResultDialog(AttendanceResult result) {
    final isPresent = result.status == 'Hadir';
    final isOutOfRadius = result.status == 'Di Luar Radius';

    Color primaryColor = isPresent
        ? const Color(0xFF10B981)
        : isOutOfRadius
            ? const Color(0xFFEF4444)
            : const Color(0xFFF59E0B);

    IconData statusIcon = isPresent
        ? Icons.check_circle
        : isOutOfRadius
            ? Icons.location_off
            : Icons.face_retouching_off;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          contentPadding: const EdgeInsets.all(24),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Status Icon Circle
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: primaryColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(statusIcon, color: primaryColor, size: 40),
              ),
              const SizedBox(height: 16),

              // Title Status
              Text(
                result.status,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: primaryColor,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),

              // Server Message
              Text(
                result.message,
                style: const TextStyle(fontSize: 13, color: Colors.black54),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),

              // Detail Info Card
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: [
                    if (result.distance != null)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Jarak ke kantor:', style: TextStyle(fontSize: 12, color: Colors.black54)),
                          Text(
                            '${result.distance!.toStringAsFixed(1)} meter',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: result.distance! <= (result.radius ?? 100) ? Colors.green : Colors.red,
                            ),
                          ),
                        ],
                      ),
                    if (result.faceConfidence != null) ...[
                      const SizedBox(height: 6),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Akurasi Kemiripan Wajah:', style: TextStyle(fontSize: 12, color: Colors.black54)),
                          Text(
                            '${result.faceConfidence!.toStringAsFixed(1)}%',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: result.faceConfidence! >= 60 ? Colors.green : Colors.orange,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Action Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: primaryColor,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    Navigator.of(context).pop();
                    if (isPresent) {
                      // Opsional: Kembali atau refresh
                    }
                  },
                  child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        );
      },
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
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Presensi Wajah & GPS', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // 1. Viewfinder Kamera Depan
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
            const Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),

          // 2. Oval Face Guide Overlay (Frame Wajah)
          CustomPaint(
            painter: OvalHoleOverlayPainter(),
            child: Container(),
          ),

          // 3. Top Info Pill: Lokasi GPS Status & Geofencing Office Proximity
          Positioned(
            top: 20,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.75),
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
            bottom: 120,
            left: 24,
            right: 24,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.6),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text(
                    'Posisikan wajah Anda tepat di dalam bingkai oval',
                    style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),

          // 5. Bottom Action: Tombol "Absen Sekarang"
          Positioned(
            bottom: 30,
            left: 24,
            right: 24,
            child: SizedBox(
              height: 54,
              child: ElevatedButton.icon(
                onPressed: _isLoading ? null : _handleTakeAttendance,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981), // Emerald Green
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 4,
                ),
                icon: _isLoading
                    ? const SizedBox.shrink()
                    : const Icon(Icons.camera_alt_rounded, size: 22),
                label: Text(
                  _isLoading ? 'Memproses...' : 'Absen Sekarang',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),

          // 6. Loading Modal Overlay saat proses berlangsung
          if (_isLoading)
            Container(
              color: Colors.black.withValues(alpha: 0.75),
              child: Center(
                child: Container(
                  padding: const EdgeInsets.all(24),
                  margin: const EdgeInsets.symmetric(horizontal: 40),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const CircularProgressIndicator(color: Color(0xFF10B981)),
                      const SizedBox(height: 16),
                      Text(
                        _loadingMessage,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87),
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
}

/// Custom Painter untuk membuat frame oval transparan di tengah dengan area luar gelap
class OvalHoleOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final backgroundPaint = Paint()..color = Colors.black.withValues(alpha: 0.5);

    // Dimensi oval penempatan wajah
    final ovalWidth = size.width * 0.72;
    final ovalHeight = size.height * 0.44;
    final ovalRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.42),
      width: ovalWidth,
      height: ovalHeight,
    );

    // Path gabungan: Layar penuh dikurangi potongan oval
    final fullScreenPath = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final ovalPath = Path()..addOval(ovalRect);
    final combinedPath = Path.combine(PathOperation.difference, fullScreenPath, ovalPath);

    canvas.drawPath(combinedPath, backgroundPaint);

    // Garis tepi oval penuntun wajah
    final borderPaint = Paint()
      ..color = const Color(0xFF10B981)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;

    canvas.drawOval(ovalRect, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
