import 'dart:convert';
import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_constants.dart';

class AttendanceResult {
  final bool isSuccess;
  final String status;
  final String message;
  final double? distance;
  final int? radius;
  final double? faceConfidence;
  final String? timestamp;

  AttendanceResult({
    required this.isSuccess,
    required this.status,
    required this.message,
    this.distance,
    this.radius,
    this.faceConfidence,
    this.timestamp,
  });

  factory AttendanceResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return AttendanceResult(
      isSuccess: json['success'] == true,
      status: data['status']?.toString() ?? (json['success'] == true ? 'Hadir' : 'Gagal'),
      message: json['message']?.toString() ?? 'Proses absensi selesai.',
      distance: data['distance'] != null ? (data['distance'] as num).toDouble() : null,
      radius: data['radius'] != null ? (data['radius'] as num).toInt() : null,
      faceConfidence: data['face_confidence'] != null ? (data['face_confidence'] as num).toDouble() : null,
      timestamp: data['timestamp']?.toString(),
    );
  }
}

class AttendanceService {
  /// Mengambil auth token JWT dari SharedPreferences lokal
  static Future<String?> _getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  /// Mengirim data presensi multipart (foto wajah + latitude + longitude) ke Express.js
  /// Endpoint: POST /api/attendance
  /// Menggunakan XFile & fromBytes agar kompatibel 100% dengan Web (Edge/Chrome) & Mobile (Android/iOS).
  static Future<AttendanceResult> submitAttendance({
    required XFile photoFile,
    required double latitude,
    required double longitude,
  }) async {
    final uri = Uri.parse(ApiConstants.submitAttendanceUrl);
    final request = http.MultipartRequest('POST', uri);

    // 1. Tambahkan Authorization Bearer Token
    final token = await _getAuthToken();
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    // 2. Tambahkan Text Fields koordinat GPS
    request.fields['latitude'] = latitude.toString();
    request.fields['longitude'] = longitude.toString();

    // 3. Tambahkan File Foto Wajah (mendukung Web dan Native tanpa MultipartFile.fromPath)
    final bytes = await photoFile.readAsBytes();
    final multipartFile = http.MultipartFile.fromBytes(
      'photo',
      bytes,
      filename: photoFile.name.isNotEmpty ? photoFile.name : 'attendance_face.jpg',
    );
    request.files.add(multipartFile);

    // 4. Kirim Request
    try {
      final streamedResponse = await request.send().timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw Exception('Koneksi timeout. Server tidak merespon dalam 30 detik.');
        },
      );

      final response = await http.Response.fromStream(streamedResponse);
      final Map<String, dynamic> responseData = jsonDecode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return AttendanceResult.fromJson(responseData);
      } else {
        // Tangani pesan error dari backend
        final errorMsg = responseData['message'] ?? 'Gagal melakukan absensi (Kode: ${response.statusCode})';
        return AttendanceResult(
          isSuccess: false,
          status: responseData['data']?['status'] ?? 'Gagal',
          message: errorMsg,
          distance: responseData['data']?['distance'] != null
              ? (responseData['data']['distance'] as num).toDouble()
              : null,
        );
      }
    } catch (e) {
      if (e is Exception) rethrow;
      throw Exception('Terjadi kesalahan saat mengirim absensi: $e');
    }
  }

  /// Mengambil riwayat absensi pengguna yang sedang login
  /// Endpoint: GET /api/attendance/history
  static Future<List<Map<String, dynamic>>> getMyHistory({int page = 1, int limit = 20}) async {
    final uri = Uri.parse('${ApiConstants.attendanceHistoryUrl}?page=$page&limit=$limit');
    final token = await _getAuthToken();

    final response = await http.get(
      uri,
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      final List<dynamic> list = decoded['data'] ?? [];
      return list.cast<Map<String, dynamic>>();
    } else {
      throw Exception('Gagal memuat riwayat presensi: ${response.body}');
    }
  }
}
