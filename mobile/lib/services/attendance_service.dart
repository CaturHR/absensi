import 'dart:convert';
import 'package:camera/camera.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_constants.dart';

class OfficeLocation {
  final int id;
  final String name;
  final double latitude;
  final double longitude;
  final int radius;

  OfficeLocation({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    required this.radius,
  });

  factory OfficeLocation.fromJson(Map<String, dynamic> json) {
    return OfficeLocation(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name']?.toString() ?? 'Kantor',
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      radius: (json['radius'] as num?)?.toInt() ?? 100,
    );
  }
}

class TodayAttendanceStatus {
  final bool hasClockedIn;
  final bool hasClockedOut;
  final String? clockInTime;
  final String? clockOutTime;

  TodayAttendanceStatus({
    required this.hasClockedIn,
    required this.hasClockedOut,
    this.clockInTime,
    this.clockOutTime,
  });

  factory TodayAttendanceStatus.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    final clockIn = data['clockIn'] as Map<String, dynamic>?;
    final clockOut = data['clockOut'] as Map<String, dynamic>?;

    String? formatTime(String? dateStr) {
      if (dateStr == null) return null;
      try {
        final dt = DateTime.parse(dateStr).toLocal();
        final h = dt.hour.toString().padLeft(2, '0');
        final m = dt.minute.toString().padLeft(2, '0');
        return '$h:$m';
      } catch (_) {
        return null;
      }
    }

    return TodayAttendanceStatus(
      hasClockedIn: data['hasClockedIn'] == true,
      hasClockedOut: data['hasClockedOut'] == true,
      clockInTime: formatTime(clockIn?['created_at']),
      clockOutTime: formatTime(clockOut?['created_at']),
    );
  }
}

class AttendanceResult {
  final bool isSuccess;
  final String status;
  final String message;
  final String? type;
  final String? time;
  final double? distance;
  final int? radius;
  final double? faceConfidence;
  final String? timestamp;
  final String? locationName;

  AttendanceResult({
    required this.isSuccess,
    required this.status,
    required this.message,
    this.type,
    this.time,
    this.distance,
    this.radius,
    this.faceConfidence,
    this.timestamp,
    this.locationName,
  });

  factory AttendanceResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return AttendanceResult(
      isSuccess: json['success'] == true,
      status: data['status']?.toString() ?? (json['success'] == true ? 'Clock In' : 'Gagal'),
      message: json['message']?.toString() ?? 'Proses presensi selesai.',
      type: data['type']?.toString(),
      time: data['time']?.toString(),
      distance: data['distance'] != null ? (data['distance'] as num).toDouble() : null,
      radius: data['radius'] != null ? (data['radius'] as num).toInt() : null,
      faceConfidence: data['face_confidence'] != null ? (data['face_confidence'] as num).toDouble() : null,
      timestamp: data['timestamp']?.toString(),
      locationName: data['location']?.toString(),
    );
  }
}

class AttendanceService {
  /// Mengambil auth token JWT dari SharedPreferences lokal
  static Future<String?> _getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  /// Mengambil data lokasi kantor/kampus aktif untuk geofencing
  /// Endpoint: GET /api/locations/active
  static Future<OfficeLocation?> getActiveOfficeLocation() async {
    try {
      final uri = Uri.parse(ApiConstants.activeLocationUrl);
      final token = await _getAuthToken();

      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true && decoded['data'] != null) {
          return OfficeLocation.fromJson(decoded['data']);
        }
      }
    } catch (_) {}
    return null;
  }

  /// Mengambil status Clock In & Clock Out pengguna untuk hari ini
  /// Endpoint: GET /api/attendance/today
  static Future<TodayAttendanceStatus?> getTodayStatus() async {
    try {
      final uri = Uri.parse(ApiConstants.todayAttendanceUrl);
      final token = await _getAuthToken();

      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        if (decoded['success'] == true) {
          return TodayAttendanceStatus.fromJson(decoded);
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  /// Mengirim data presensi multipart (foto wajah + latitude + longitude + type) ke Express.js
  /// Endpoint: POST /api/attendance
  /// Menggunakan XFile, fromBytes & MediaType('image', 'jpeg') agar kompatibel 100% dengan Web & Mobile.
  static Future<AttendanceResult> submitAttendance({
    required XFile photoFile,
    required double latitude,
    required double longitude,
    String type = 'in',
  }) async {
    final uri = Uri.parse(ApiConstants.submitAttendanceUrl);
    final request = http.MultipartRequest('POST', uri);

    // 1. Tambahkan Authorization Bearer Token
    final token = await _getAuthToken();
    if (token != null && token.isNotEmpty) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    // 2. Tambahkan Text Fields koordinat GPS & type ('in' / 'out')
    request.fields['latitude'] = latitude.toString();
    request.fields['longitude'] = longitude.toString();
    request.fields['type'] = type;

    // 3. Tambahkan File Foto Wajah dengan explicit MediaType
    final bytes = await photoFile.readAsBytes();
    final multipartFile = http.MultipartFile.fromBytes(
      'photo',
      bytes,
      filename: photoFile.name.isNotEmpty ? photoFile.name : 'attendance_face.jpg',
      contentType: MediaType('image', 'jpeg'),
    );
    request.files.add(multipartFile);

    // 4. Kirim Request
    try {
      final streamedResponse = await request.send().timeout(
        const Duration(seconds: 35),
        onTimeout: () {
          throw Exception('Koneksi timeout. Server tidak merespon dalam 35 detik.');
        },
      );

      final response = await http.Response.fromStream(streamedResponse);
      final Map<String, dynamic> responseData = jsonDecode(response.body);

      if (response.statusCode == 200 || response.statusCode == 201) {
        return AttendanceResult.fromJson(responseData);
      } else {
        // Tangani error terstruktur dari backend
        final errorMsg = responseData['message'] ?? 'Gagal melakukan absensi (Kode: ${response.statusCode})';
        return AttendanceResult(
          isSuccess: false,
          status: responseData['data']?['status'] ?? 'Gagal',
          message: errorMsg,
          distance: responseData['data']?['distance'] != null
              ? (responseData['data']['distance'] as num).toDouble()
              : null,
          radius: responseData['data']?['radius'] != null
              ? (responseData['data']['radius'] as num).toInt()
              : null,
          faceConfidence: responseData['data']?['face_confidence'] != null
              ? (responseData['data']['face_confidence'] as num).toDouble()
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
    ).timeout(const Duration(seconds: 15));

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      final List<dynamic> list = decoded['data'] ?? [];
      return list.cast<Map<String, dynamic>>();
    } else {
      final decoded = jsonDecode(response.body);
      throw Exception(decoded['message'] ?? 'Gagal memuat riwayat presensi: ${response.statusCode}');
    }
  }
}
