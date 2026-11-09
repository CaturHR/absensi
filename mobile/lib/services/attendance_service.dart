import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_constants.dart';

class TodayAttendanceStatus {
  final bool hasClockedIn;
  final bool hasClockedOut;
  final String? clockInTime;
  final String? clockOutTime;
  final bool hasLeaveToday;
  final String? leaveReason;
  final String? leaveStatus;
  final Map<String, dynamic>? todayLeave;

  TodayAttendanceStatus({
    required this.hasClockedIn,
    required this.hasClockedOut,
    this.clockInTime,
    this.clockOutTime,
    this.hasLeaveToday = false,
    this.leaveReason,
    this.leaveStatus,
    this.todayLeave,
  });

  factory TodayAttendanceStatus.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    final clockIn = data['clockIn'] as Map<String, dynamic>?;
    final clockOut = data['clockOut'] as Map<String, dynamic>?;
    final todayLeave = data['todayLeave'] as Map<String, dynamic>?;

    String? formatTime(Map<String, dynamic>? record) {
      if (record == null) return null;
      if (record['time'] != null && record['time'].toString().isNotEmpty) {
        return record['time'].toString();
      }
      final dateStr = record['created_at']?.toString();
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
      clockInTime: formatTime(clockIn),
      clockOutTime: formatTime(clockOut),
      hasLeaveToday: data['hasLeaveToday'] == true,
      leaveReason: todayLeave?['reason']?.toString(),
      leaveStatus: todayLeave?['status']?.toString(),
      todayLeave: todayLeave,
    );
  }
}

class AttendanceResult {
  final bool isSuccess;
  final String status;
  final String message;
  final String? time;

  AttendanceResult({
    required this.isSuccess,
    required this.status,
    required this.message,
    this.time,
  });

  factory AttendanceResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? {};
    return AttendanceResult(
      isSuccess: json['success'] == true,
      status: data['status']?.toString() ?? (json['success'] == true ? 'Clock In' : 'Gagal'),
      message: json['message']?.toString() ?? 'Proses presensi selesai.',
      time: data['time']?.toString(),
    );
  }
}

class AttendanceService {
  static Future<String?> _getAuthToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('auth_token');
  }

  /// Mengambil status Clock In & Clock Out hari ini
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
    } catch (_) {}
    return null;
  }

  /// Mengambil data permohonan izin hari ini milik user
  /// Endpoint: GET /api/leaves/today
  static Future<Map<String, dynamic>?> getTodayLeave() async {
    try {
      final uri = Uri.parse(ApiConstants.todayLeaveUrl);
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
          return decoded['data'] as Map<String, dynamic>;
        }
      }
    } catch (_) {}
    return null;
  }

  /// Mengirim absensi Clock In atau Clock Out tanpa AI dan tanpa Lokasi
  /// Endpoint: POST /api/attendance
  /// Body: { type: 'in' | 'out' }
  static Future<AttendanceResult> submitAttendance({required String type}) async {
    try {
      final uri = Uri.parse(ApiConstants.submitAttendanceUrl);
      final token = await _getAuthToken();

      final response = await http.post(
        uri,
        headers: {
          'Content-Type': 'application/json',
          if (token != null) 'Authorization': 'Bearer $token',
        },
        body: jsonEncode({'type': type}),
      ).timeout(const Duration(seconds: 15));

      final decoded = jsonDecode(response.body);
      return AttendanceResult.fromJson(decoded);
    } catch (e) {
      return AttendanceResult(
        isSuccess: false,
        status: 'Error',
        message: 'Gagal terhubung ke server: ${e.toString()}',
      );
    }
  }

  /// Mengambil riwayat absensi user
  /// Endpoint: GET /api/attendance/history
  static Future<List<Map<String, dynamic>>> getMyHistory({int page = 1, int limit = 50}) async {
    try {
      final uri = Uri.parse('${ApiConstants.attendanceHistoryUrl}?page=$page&limit=$limit');
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
          final list = decoded['data'] as List<dynamic>;
          return list.map((e) => e as Map<String, dynamic>).toList();
        }
      }
    } catch (_) {}
    return [];
  }
}
