import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_constants.dart';

/// Halaman Pengajuan Izin - Upload file, foto kamera, alasan, keterangan, submit
class LeaveScreen extends StatefulWidget {
  final List<CameraDescription> cameras;

  const LeaveScreen({super.key, required this.cameras});

  @override
  State<LeaveScreen> createState() => _LeaveScreenState();
}

class _LeaveScreenState extends State<LeaveScreen> {
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _descriptionController = TextEditingController();
  XFile? _attachmentFile;
  String? _attachmentName;
  bool _isSubmitting = false;
  bool _isCapturedFromCamera = false;

  @override
  void dispose() {
    _reasonController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  /// Ambil foto menggunakan kamera
  Future<void> _captureFromCamera() async {
    if (widget.cameras.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Tidak ada kamera terdeteksi pada perangkat.'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    final frontCamera = widget.cameras.firstWhere(
      (c) => c.lensDirection == CameraLensDirection.back,
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
          SnackBar(
            content: Text('Gagal mengakses kamera: $e'),
            backgroundColor: Colors.red,
          ),
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
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Ambil Foto Lampiran',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  width: 280,
                  height: 280,
                  child: CameraPreview(controller),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Arahkan kamera ke dokumen atau objek yang ingin dilampirkan.',
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

    if (capturedFile != null && mounted) {
      setState(() {
        _attachmentFile = capturedFile;
        _attachmentName = 'Foto Kamera (${capturedFile.name})';
        _isCapturedFromCamera = true;
      });
    }
  }

  /// Submit permohonan izin
  Future<void> _submitLeaveRequest() async {
    final reason = _reasonController.text.trim();
    final description = _descriptionController.text.trim();

    if (reason.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Alasan izin wajib diisi.'),
          backgroundColor: Colors.orange,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');

      final uri = Uri.parse('${ApiConstants.baseUrl}/api/leaves');
      final request = http.MultipartRequest('POST', uri);

      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      request.fields['reason'] = reason;
      if (description.isNotEmpty) {
        request.fields['description'] = description;
      }

      // Lampirkan file jika ada
      if (_attachmentFile != null) {
        final bytes = await _attachmentFile!.readAsBytes();
        final ext = _attachmentFile!.name.split('.').last.toLowerCase();
        String mimeType = 'image';
        String mimeSubtype = 'jpeg';

        if (ext == 'png') {
          mimeSubtype = 'png';
        } else if (ext == 'pdf') {
          mimeType = 'application';
          mimeSubtype = 'pdf';
        } else if (ext == 'doc' || ext == 'docx') {
          mimeType = 'application';
          mimeSubtype = 'octet-stream';
        }

        request.files.add(
          http.MultipartFile.fromBytes(
            'attachment',
            bytes,
            filename: _attachmentFile!.name.isNotEmpty
                ? _attachmentFile!.name
                : 'lampiran.$ext',
            contentType: MediaType(mimeType, mimeSubtype),
          ),
        );
      }

      final streamedResponse = await request.send().timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw Exception('Koneksi timeout. Server tidak merespon.');
        },
      );

      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body);

      if (mounted) {
        if (response.statusCode == 201 || response.statusCode == 200) {
          _showSuccessDialog(data['message'] ?? 'Permohonan izin berhasil dikirim.');
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['message'] ?? 'Gagal mengirim izin.'),
              backgroundColor: Colors.red,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal: ${e.toString().replaceAll('Exception: ', '')}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  void _showSuccessDialog(String message) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 76,
              height: 76,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded,
                  color: Color(0xFF10B981), size: 44),
            ),
            const SizedBox(height: 16),
            const Text(
              'Izin Terkirim!',
              style: TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF0F172A)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              message,
              style: const TextStyle(fontSize: 13, color: Colors.black54),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
        actions: [
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                // Reset form setelah berhasil kirim
                _reasonController.clear();
                _descriptionController.clear();
                setState(() {
                  _attachmentFile = null;
                  _attachmentName = null;
                  _isCapturedFromCamera = false;
                });
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: const Text('Mengerti',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F7F2),
      appBar: AppBar(
        title: const Text('Pengajuan Izin',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white.withValues(alpha: 0.88),
        foregroundColor: const Color(0xFF242721),
        elevation: 0,
        centerTitle: true,
        automaticallyImplyLeading: false,
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background image sama dengan halaman lainnya
          Image.asset(
            'lib/asset/baground/BG.png',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) =>
                Container(color: const Color(0xFF365C4A)),
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

          // Form Content
          SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ─── Upload / Kamera Section ───
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.94),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.8)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.attach_file_rounded,
                              color: Color(0xFF6366F1), size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Lampiran',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF242721),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Upload file atau ambil foto dengan kamera',
                        style: TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                      const SizedBox(height: 16),

                      // Preview lampiran jika ada
                      if (_attachmentFile != null) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981)
                                .withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                                color: const Color(0xFF10B981)
                                    .withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle,
                                  color: Color(0xFF10B981), size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _attachmentName ?? 'File terlampir',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF065F46),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close,
                                    size: 18, color: Colors.red),
                                onPressed: () {
                                  setState(() {
                                    _attachmentFile = null;
                                    _attachmentName = null;
                                    _isCapturedFromCamera = false;
                                  });
                                },
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),

                        // Show image preview if captured from camera
                        if (_isCapturedFromCamera)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Image.file(
                              File(_attachmentFile!.path),
                              height: 180,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  const SizedBox.shrink(),
                            ),
                          ),
                        if (_isCapturedFromCamera) const SizedBox(height: 12),
                      ],

                      // Buttons Row
                      Row(
                        children: [
                          // Tombol Ambil Foto Kamera
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _captureFromCamera,
                              style: OutlinedButton.styleFrom(
                                foregroundColor: const Color(0xFF6366F1),
                                side: const BorderSide(
                                    color: Color(0xFF6366F1), width: 1.5),
                                shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14)),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 14),
                              ),
                              icon:
                                  const Icon(Icons.camera_alt_rounded, size: 20),
                              label: const Text('Kamera',
                                  style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.bold)),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ─── Alasan ───
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.94),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.8)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.edit_note_rounded,
                              color: Color(0xFFF59E0B), size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Alasan Izin *',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF242721),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _reasonController,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: 'Contoh: Sakit, Urusan keluarga, dll.',
                          hintStyle: const TextStyle(
                              fontSize: 13, color: Colors.black38),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide:
                                const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide:
                                const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(
                                color: Color(0xFF365C4A), width: 2),
                          ),
                          contentPadding: const EdgeInsets.all(14),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 16),

                // ─── Keterangan ───
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.94),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.08),
                        blurRadius: 14,
                        offset: const Offset(0, 4),
                      ),
                    ],
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.8)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.notes_rounded,
                              color: Color(0xFF3B82F6), size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Keterangan',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF242721),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _descriptionController,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText:
                              'Tambahkan keterangan detail (opsional)...',
                          hintStyle: const TextStyle(
                              fontSize: 13, color: Colors.black38),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide:
                                const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide:
                                const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                            borderSide: const BorderSide(
                                color: Color(0xFF365C4A), width: 2),
                          ),
                          contentPadding: const EdgeInsets.all(14),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                // ─── Submit Button ───
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitLeaveRequest,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF365C4A),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      elevation: 2,
                      disabledBackgroundColor: Colors.grey.shade400,
                    ),
                    child: _isSubmitting
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              ),
                              SizedBox(width: 12),
                              Text('Mengirim...',
                                  style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold)),
                            ],
                          )
                        : const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.send_rounded, size: 20),
                              SizedBox(width: 10),
                              Text('Submit Permohonan Izin',
                                  style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold)),
                            ],
                          ),
                  ),
                ),

                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
