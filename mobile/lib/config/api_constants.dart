import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;
import 'package:shared_preferences/shared_preferences.dart';

class ApiConstants {
  static const String _prefKeyCustomBaseUrl = 'custom_base_url';
  static String? _cachedBaseUrl;

  /// Inisialisasi API Constants (memuat baseUrl tersimpan dari SharedPreferences jika ada)
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _cachedBaseUrl = prefs.getString(_prefKeyCustomBaseUrl);
  }

  /// Base URL aktif (prioritas: custom URL pengguna > default platform)
  static String get baseUrl {
    if (_cachedBaseUrl != null && _cachedBaseUrl!.trim().isNotEmpty) {
      return _cachedBaseUrl!.trim().replaceAll(RegExp(r'/+$'), '');
    }

    if (kIsWeb) {
      try {
        final host = Uri.base.host;
        if (host.isNotEmpty && host != 'localhost' && host != '127.0.0.1') {
          return 'http://$host:5000';
        }
      } catch (_) {}
      return 'http://localhost:5000';
    }
    try {
      if (Platform.isAndroid) {
        // Jika di HP fisik, arahkan ke IP Wi-Fi PC (192.168.0.233)
        return 'http://192.168.0.233:5000';
      }
    } catch (_) {}
    return 'http://localhost:5000';
  }

  /// Mengatur custom base URL (misalnya jika pengujian menggunakan HP fisik via Wi-Fi IP komputer)
  static Future<void> setCustomBaseUrl(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    if (url == null || url.trim().isEmpty) {
      await prefs.remove(_prefKeyCustomBaseUrl);
      _cachedBaseUrl = null;
    } else {
      final sanitized = url.trim().replaceAll(RegExp(r'/+$'), '');
      await prefs.setString(_prefKeyCustomBaseUrl, sanitized);
      _cachedBaseUrl = sanitized;
    }
  }

  /// Default Base URL sesuai platform saat ini
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return 'http://localhost:5000';
    }
    try {
      if (Platform.isAndroid) {
        return 'http://10.0.2.2:5000';
      }
    } catch (_) {}
    return 'http://localhost:5000';
  }

  // Auth Endpoints
  static String get loginUrl => '$baseUrl/api/auth/login';
  static String get profileUrl => '$baseUrl/api/auth/profile';
  static String get uploadFaceUrl => '$baseUrl/api/auth/face';

  // Attendance Endpoints
  static String get submitAttendanceUrl => '$baseUrl/api/attendance';
  static String get attendanceHistoryUrl => '$baseUrl/api/attendance/history';
  static String get todayAttendanceUrl => '$baseUrl/api/attendance/today';

  // Location Endpoints
  static String get activeLocationUrl => '$baseUrl/api/locations/active';

  // Health Endpoint
  static String get healthUrl => '$baseUrl/api/health';
}
