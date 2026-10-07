import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:image_picker/image_picker.dart';
import '../config/api_constants.dart';
import '../services/attendance_service.dart';
import '../widgets/liquid_glass.dart';

/// Halaman Pengajuan / Edit Izin Karyawan
/// Aturan:
/// 1. Izin hanya dapat diajukan 1 kali per hari. Jika sudah izin, user hanya dapat mengedit izinnya.
/// 2. Jika user sudah melakukan Clock In hari ini, pengajuan izin ditutup karena sudah tercatat hadir.
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

  bool _isLoadingInitial = true;
  bool _hasClockedIn = false;
  String? _clockInTime;
  bool _isEditMode = false;
  int? _existingLeaveId;
  String? _existingAttachment;
  String? _existingLeaveStatus;
  bool _removeAttachment = false;

  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    _loadTodayLeaveStatus();
  }

  @override
  void dispose() {
    _reasonController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  /// Memuat data status izin dan status Clock In hari ini
  Future<void> _loadTodayLeaveStatus() async {
    setState(() => _isLoadingInitial = true);
    try {
      final res = await AttendanceService.getTodayLeave();
      if (res != null && mounted) {
        final leave = res['leave'] as Map<String, dynamic>?;
        final hasClockedIn = res['hasClockedIn'] == true;
        final clockInTime = res['clockInTime']?.toString();

        setState(() {
          _hasClockedIn = hasClockedIn;
          _clockInTime = clockInTime;
          if (leave != null) {
            _isEditMode = true;
            _existingLeaveId = (leave['id'] as num?)?.toInt();
            _existingLeaveStatus = leave['status']?.toString();
            _reasonController.text = leave['reason']?.toString() ?? '';
            _descriptionController.text = leave['description']?.toString() ?? '';
            _existingAttachment = leave['attachment']?.toString();
          } else {
            _isEditMode = false;
            _existingLeaveId = null;
            _existingAttachment = null;
          }
        });
      }
    } catch (e) {
      debugPrint('Error loading today leave status: $e');
    } finally {
      if (mounted) setState(() => _isLoadingInitial = false);
    }
  }

  /// Ambil foto menggunakan kamera native
  Future<void> _captureFromCamera() async {
    if (_hasClockedIn) return;
    try {
      final XFile? capturedFile = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 80,
      );

      if (capturedFile != null && mounted) {
        setState(() {
          _attachmentFile = capturedFile;
          _attachmentName = 'Foto Kamera (${capturedFile.name})';
          _isCapturedFromCamera = true;
          _removeAttachment = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mengambil foto: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Pilih foto atau dokumen dari galeri
  Future<void> _pickFromGallery() async {
    if (_hasClockedIn) return;
    try {
      final XFile? pickedFile = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
      );

      if (pickedFile != null && mounted) {
        setState(() {
          _attachmentFile = pickedFile;
          _attachmentName = 'Galeri (${pickedFile.name})';
          _isCapturedFromCamera = false;
          _removeAttachment = false;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal memilih file: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  /// Submit permohonan izin (baru atau edit)
  Future<void> _submitLeaveRequest() async {
    if (_isSubmitting) return;

    if (_hasClockedIn) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Anda sudah melakukan Clock In hari ini sehingga tidak dapat mengajukan izin.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

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

      final String method = _isEditMode ? 'PUT' : 'POST';
      final Uri uri = _isEditMode && _existingLeaveId != null
          ? Uri.parse('${ApiConstants.baseUrl}/api/leaves/$_existingLeaveId')
          : Uri.parse('${ApiConstants.baseUrl}/api/leaves');

      final request = http.MultipartRequest(method, uri);

      if (token != null && token.isNotEmpty) {
        request.headers['Authorization'] = 'Bearer $token';
      }

      request.fields['reason'] = reason;
      if (description.isNotEmpty) {
        request.fields['description'] = description;
      }
      if (_removeAttachment) {
        request.fields['remove_attachment'] = 'true';
      }

      // Lampirkan file baru jika dipilih
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
          final isEdit = _isEditMode;
          _showSuccessDialog(
            title: isEdit ? 'Izin Diperbarui!' : 'Izin Terkirim!',
            message: data['message'] ?? (isEdit ? 'Permohonan izin berhasil diperbarui.' : 'Permohonan izin berhasil dikirim.'),
          );
          await _loadTodayLeaveStatus();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(data['message'] ?? 'Gagal memproses izin.'),
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

  void _showSuccessDialog({required String title, required String message}) {
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
            Text(
              title,
              style: const TextStyle(
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
                setState(() {
                  _attachmentFile = null;
                  _attachmentName = null;
                  _isCapturedFromCamera = false;
                  _removeAttachment = false;
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
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: LiquidGlassAppBar(
        title: _isEditMode ? 'Edit Permohonan Izin' : 'Pengajuan Izin',
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            tooltip: 'Segarkan',
            onPressed: _loadTodayLeaveStatus,
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background image
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
          SafeArea(
            child: _isLoadingInitial
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  )
                : SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ─── 1. BANNER STATUS (JIKA SUDAH CLOCK IN / JIKA DALAM MODE EDIT) ───
                        if (_hasClockedIn)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEF4444).withValues(alpha: 0.94),
                              borderRadius: BorderRadius.circular(20),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 14,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(Icons.block_rounded,
                                    color: Colors.white, size: 26),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Tidak Dapat Mengajukan Izin',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Anda sudah melakukan Clock In hari ini pada pukul ${_clockInTime ?? "-"} dan tercatat hadir di sistem. Sesuai aturan, izin tidak dapat diajukan setelah presensi kehadiran dilakukan.',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          height: 1.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          )
                        else if (_isEditMode)
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 16),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.94),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                  color: const Color(0xFFF59E0B)
                                      .withValues(alpha: 0.4),
                                  width: 1.5),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.08),
                                  blurRadius: 14,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(6),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF59E0B)
                                        .withValues(alpha: 0.15),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.edit_note_rounded,
                                      color: Color(0xFFD97706), size: 22),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          const Text(
                                            'Mode Edit Izin Hari Ini',
                                            style: TextStyle(
                                              color: Color(0xFF92400E),
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                            ),
                                          ),
                                          const Spacer(),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: (_existingLeaveStatus ==
                                                          'approved'
                                                      ? const Color(0xFF10B981)
                                                      : (_existingLeaveStatus ==
                                                              'rejected'
                                                          ? const Color(0xFFEF4444)
                                                          : const Color(0xFFF59E0B)))
                                                  .withValues(alpha: 0.15),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: Text(
                                              _existingLeaveStatus == 'approved'
                                                  ? 'Disetujui'
                                                  : (_existingLeaveStatus ==
                                                          'rejected'
                                                      ? 'Ditolak'
                                                      : 'Pending'),
                                              style: TextStyle(
                                                fontSize: 10,
                                                fontWeight: FontWeight.bold,
                                                color: _existingLeaveStatus ==
                                                        'approved'
                                                    ? const Color(0xFF047857)
                                                    : (_existingLeaveStatus ==
                                                            'rejected'
                                                        ? const Color(0xFFB91C1C)
                                                        : const Color(0xFFB45309)),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      const Text(
                                        'Pengajuan izin dibatasi 1 kali per hari. Anda hanya dapat mengubah/mengedit alasan, keterangan, dan lampiran permohonan izin ini.',
                                        style: TextStyle(
                                          color: Color(0xFF78350F),
                                          fontSize: 11.5,
                                          height: 1.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                        // ─── 2. LAMPIRAN SECTION ───
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
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.8)),
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
                                    'Lampiran Surat / Bukti',
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
                                'Ambil foto kamera atau pilih file dari galeri',
                                style: TextStyle(
                                    fontSize: 12, color: Colors.black54),
                              ),
                              const SizedBox(height: 16),

                              // Preview lampiran baru yang baru dipilih
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
                                        onPressed: _hasClockedIn
                                            ? null
                                            : () {
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
                                if (_isCapturedFromCamera)
                                  const SizedBox(height: 12),
                              ] else if (_existingAttachment != null &&
                                  !_removeAttachment) ...[
                                // Lampiran yang tersimpan dari pengajuan sebelumnya
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF3B82F6)
                                        .withValues(alpha: 0.08),
                                    borderRadius: BorderRadius.circular(14),
                                    border: Border.all(
                                        color: const Color(0xFF3B82F6)
                                            .withValues(alpha: 0.3)),
                                  ),
                                  child: Row(
                                    children: [
                                      const Icon(Icons.file_present_rounded,
                                          color: Color(0xFF2563EB), size: 20),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          'Lampiran saat ini: ${_existingAttachment!.split("/").last}',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: Color(0xFF1E40AF),
                                          ),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline,
                                            size: 18, color: Colors.red),
                                        tooltip: 'Hapus lampiran',
                                        onPressed: _hasClockedIn
                                            ? null
                                            : () {
                                                setState(() {
                                                  _removeAttachment = true;
                                                });
                                              },
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 12),
                              ],

                              // Tombol Aksi Lampiran (Kamera & Galeri)
                              Row(
                                children: [
                                  // Tombol Ambil Foto Kamera
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: _hasClockedIn
                                          ? null
                                          : _captureFromCamera,
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: const Color(0xFF6366F1),
                                        side: const BorderSide(
                                            color: Color(0xFF6366F1), width: 1.5),
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(14)),
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 14),
                                      ),
                                      icon: const Icon(
                                          Icons.camera_alt_rounded,
                                          size: 18),
                                      label: const Text('Kamera',
                                          style: TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.bold)),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  // Tombol Ambil File dari Galeri
                                  Expanded(
                                    child: OutlinedButton.icon(
                                      onPressed: _hasClockedIn
                                          ? null
                                          : _pickFromGallery,
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: const Color(0xFF0D9488),
                                        side: const BorderSide(
                                            color: Color(0xFF0D9488), width: 1.5),
                                        shape: RoundedRectangleBorder(
                                            borderRadius:
                                                BorderRadius.circular(14)),
                                        padding: const EdgeInsets.symmetric(
                                            vertical: 14),
                                      ),
                                      icon: const Icon(
                                          Icons.photo_library_rounded,
                                          size: 18),
                                      label: const Text('Galeri',
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

                        // ─── 3. ALASAN IZIN ───
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
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.8)),
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
                                enabled: !_hasClockedIn,
                                maxLines: 2,
                                decoration: InputDecoration(
                                  hintText:
                                      'Contoh: Sakit demam, Keperluan keluarga, dsb.',
                                  hintStyle: const TextStyle(
                                      fontSize: 13, color: Colors.black38),
                                  filled: true,
                                  fillColor: _hasClockedIn
                                      ? const Color(0xFFF1F5F9)
                                      : const Color(0xFFF8FAFC),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: Color(0xFFE2E8F0)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: Color(0xFFE2E8F0)),
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

                        // ─── 4. KETERANGAN ───
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
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.8)),
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
                                    'Keterangan Tambahan',
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
                                enabled: !_hasClockedIn,
                                maxLines: 4,
                                decoration: InputDecoration(
                                  hintText:
                                      'Tambahkan keterangan detail atau catatan khusus (opsional)...',
                                  hintStyle: const TextStyle(
                                      fontSize: 13, color: Colors.black38),
                                  filled: true,
                                  fillColor: _hasClockedIn
                                      ? const Color(0xFFF1F5F9)
                                      : const Color(0xFFF8FAFC),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: Color(0xFFE2E8F0)),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(14),
                                    borderSide: const BorderSide(
                                        color: Color(0xFFE2E8F0)),
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

                        // ─── 5. SUBMIT BUTTON ───
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: ElevatedButton(
                            onPressed: (_isSubmitting || _hasClockedIn)
                                ? null
                                : _submitLeaveRequest,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _isEditMode
                                  ? const Color(0xFFD97706)
                                  : const Color(0xFF365C4A),
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
                                      Text('Menyimpan...',
                                          style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.bold)),
                                    ],
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        _hasClockedIn
                                            ? Icons.lock_rounded
                                            : (_isEditMode
                                                ? Icons.save_rounded
                                                : Icons.send_rounded),
                                        size: 20,
                                      ),
                                      const SizedBox(width: 10),
                                      Text(
                                        _hasClockedIn
                                            ? 'Pengajuan Ditutup (Sudah Hadir)'
                                            : (_isEditMode
                                                ? 'Simpan Perubahan Izin'
                                                : 'Submit Permohonan Izin'),
                                        style: const TextStyle(
                                            fontSize: 15,
                                            fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                          ),
                        ),

                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
