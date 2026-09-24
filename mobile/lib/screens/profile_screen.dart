import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import '../config/api_constants.dart';
import '../services/auth_service.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  final List<CameraDescription> cameras;

  const ProfileScreen({super.key, required this.cameras});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, String> _userData = {
    'name': '...',
    'nip': '...',
    'email': '...',
    'role': '...',
    'face_photo': '',
  };
  bool _isLoading = true;
  bool _isUploadingFace = false;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final localData = await AuthService.getUserData();
    setState(() {
      _userData = localData;
      _isLoading = false;
    });

    // Ambil data terbaru dari server
    final serverData = await AuthService.fetchProfile();
    if (serverData != null && mounted) {
      final updatedLocal = await AuthService.getUserData();
      setState(() {
        _userData = updatedLocal;
      });
    }
  }

  Future<void> _handleUploadFacePhoto() async {
    if (widget.cameras.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Tidak ada kamera terdeteksi pada perangkat.')),
      );
      return;
    }

    final frontCamera = widget.cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.front,
      orElse: () => widget.cameras.first,
    );

    final controller = CameraController(
      frontCamera,
      ResolutionPreset.medium,
      enableAudio: false,
    );

    try {
      await controller.initialize();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menginisialisasi kamera: $e')),
        );
      }
      return;
    }

    if (!mounted) return;

    final XFile? capturedFile = await showDialog<XFile>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Ambil Foto Master Wajah', style: TextStyle(fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  width: 240,
                  height: 240,
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: CameraPreview(controller),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Pastikan wajah menghadap depan dengan pencahayaan cukup.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                controller.dispose();
                Navigator.pop(ctx, null);
              },
              child: const Text('Batal'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF365C4A),
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                try {
                  final photo = await controller.takePicture();
                  controller.dispose();
                  if (ctx.mounted) Navigator.pop(ctx, photo);
                } catch (err) {
                  controller.dispose();
                  if (ctx.mounted) Navigator.pop(ctx, null);
                }
              },
              child: const Text('Ambil Foto'),
            ),
          ],
        );
      },
    );

    if (capturedFile != null) {
      setState(() => _isUploadingFace = true);
      final result = await AuthService.uploadMasterFace(capturedFile);
      setState(() => _isUploadingFace = false);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(result['message'] ?? ''),
            backgroundColor: result['success'] == true ? Colors.green : Colors.red,
          ),
        );
        _loadUserData();
      }
    }
  }

  void _showServerSettingsDialog() {
    final controller = TextEditingController(text: ApiConstants.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Pengaturan Server Backend', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Alamat URL Backend API (Express.js):',
              style: TextStyle(fontSize: 12, color: Colors.black54),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                hintText: 'http://192.168.1.xxx:5000',
                isDense: true,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Default: ${ApiConstants.defaultBaseUrl}',
              style: const TextStyle(fontSize: 11, color: Colors.black45),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await ApiConstants.setCustomBaseUrl(null);
              if (ctx.mounted) {
                Navigator.pop(ctx);
                setState(() {});
              }
            },
            child: const Text('Reset Default'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF365C4A),
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              await ApiConstants.setCustomBaseUrl(controller.text);
              if (ctx.mounted) {
                Navigator.pop(ctx);
                setState(() {});
              }
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Konfirmasi Keluar'),
        content: const Text('Apakah Anda yakin ingin keluar dari akun ini?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await AuthService.logout();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (context) => LoginScreen(cameras: widget.cameras)),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasMasterFace = (_userData['face_photo'] ?? '').isNotEmpty;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F2),
      appBar: AppBar(
        title: const Text('Profil Saya', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF242721),
        elevation: 0.5,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: _showServerSettingsDialog,
            tooltip: 'Pengaturan Server',
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            onPressed: _handleLogout,
            tooltip: 'Keluar',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF365C4A)))
          : RefreshIndicator(
              onRefresh: _loadUserData,
              color: const Color(0xFF365C4A),
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  // User Avatar & Name Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: const Color(0xFF365C4A).withValues(alpha: 0.15),
                          child: Text(
                            (_userData['name'] ?? 'K').substring(0, 1).toUpperCase(),
                            style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF365C4A),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          _userData['name'] ?? '-',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF242721)),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'NIP: ${_userData['nip'] ?? '-'}',
                          style: const TextStyle(fontSize: 13, color: Colors.black54),
                        ),
                        const SizedBox(height: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFF365C4A).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            (_userData['role'] ?? 'user').toUpperCase(),
                            style: const TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF365C4A),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Biometric Face Status Card
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              hasMasterFace ? Icons.verified_user_rounded : Icons.warning_amber_rounded,
                              color: hasMasterFace ? const Color(0xFF10B981) : Colors.orange,
                              size: 22,
                            ),
                            const SizedBox(width: 8),
                            const Text(
                              'Master Biometrik Wajah',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF242721)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          hasMasterFace
                              ? 'Foto master wajah Anda telah terdaftar di sistem. Anda dapat memperbaruinya jika diinginkan.'
                              : 'Anda belum mendaftarkan foto master wajah. Harap ambil foto selfie wajah untuk aktivasi presensi.',
                          style: const TextStyle(fontSize: 12, color: Colors.black54),
                        ),
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: hasMasterFace ? Colors.grey.shade100 : const Color(0xFF365C4A),
                              foregroundColor: hasMasterFace ? const Color(0xFF242721) : Colors.white,
                              elevation: hasMasterFace ? 0 : 2,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: _isUploadingFace ? null : _handleUploadFacePhoto,
                            icon: _isUploadingFace
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Icon(hasMasterFace ? Icons.refresh : Icons.camera_alt_rounded, size: 18),
                            label: Text(hasMasterFace ? 'Perbarui Foto Wajah' : 'Daftarkan Foto Wajah Sekarang'),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Connection & Info Card
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Informasi Aplikasi & Server',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF242721)),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Email Akun', style: TextStyle(fontSize: 12, color: Colors.black54)),
                            Text(_userData['email'] ?? '-', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Server API Base', style: TextStyle(fontSize: 12, color: Colors.black54)),
                            Text(ApiConstants.baseUrl, style: const TextStyle(fontSize: 11, fontFamily: 'monospace')),
                          ],
                        ),
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Status Koneksi', style: TextStyle(fontSize: 12, color: Colors.black54)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Text('Terhubung', style: TextStyle(fontSize: 11, color: Color(0xFF10B981), fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
