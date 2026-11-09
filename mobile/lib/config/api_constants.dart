import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class ApiConstants {
  static const String _prefKeyCustomBaseUrl = 'custom_base_url';
  static String? _cachedBaseUrl;
  static String? _autoDetectedUrl;

  /// Daftar kandidat URL lokal untuk pengujian Android
  /// 127.0.0.1 via ADB reverse adalah metode paling stabil & kebal perubahan IP Wi-Fi
  static const List<String> localAndroidCandidates = [
    'http://127.0.0.1:5000',    // Port forwarding USB via ADB reverse (Sangat Stabil)
    'http://10.0.2.2:5000',     // Android Studio Emulator
    'http://localhost:5000',    // Localhost loopback
  ];

  /// Inisialisasi API Constants (memuat baseUrl tersimpan dari SharedPreferences jika ada)
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _cachedBaseUrl = prefs.getString(_prefKeyCustomBaseUrl);

    // Jika belum ada custom URL tetap dan platform adalah Android, auto-detect candidate yang aktif
    if ((_cachedBaseUrl == null || _cachedBaseUrl!.isEmpty) &&
        !kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android) {
      _autoDetectedUrl = await detectBestUrl();
    }
  }

  /// Cek kandidat URL lokal yang aktif dan merespon /api/health secara paralel
  static Future<String?> detectBestUrl() async {
    final List<String> testList = [
      ...localAndroidCandidates,
      if (_cachedBaseUrl != null && _cachedBaseUrl!.isNotEmpty) _cachedBaseUrl!,
    ];

    // Tes semua kandidat secara paralel agar tidak ada waktu tunggu berlebih
    final futures = testList.map((candidate) async {
      try {
        final clean = candidate.trim().replaceAll(RegExp(r'/+$'), '');
        final uri = Uri.parse('$clean/api/health');
        final res = await http.get(uri).timeout(const Duration(milliseconds: 1500));
        if (res.statusCode == 200) {
          return clean;
        }
      } catch (_) {}
      return null;
    });

    final results = await Future.wait(futures);
    for (final res in results) {
      if (res != null) return res;
    }
    return null;
  }

  /// Base URL aktif (prioritas: custom URL pengguna > hasil auto-detect > default lokal 127.0.0.1)
  static String get baseUrl {
    if (_cachedBaseUrl != null && _cachedBaseUrl!.trim().isNotEmpty) {
      return _cachedBaseUrl!.trim().replaceAll(RegExp(r'/+$'), '');
    }

    if (_autoDetectedUrl != null && _autoDetectedUrl!.trim().isNotEmpty) {
      return _autoDetectedUrl!.trim().replaceAll(RegExp(r'/+$'), '');
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

    if (defaultTargetPlatform == TargetPlatform.android) {
      // Default ke 127.0.0.1:5000 (bekerja via ADB reverse tanpa tergantung jaringan Wi-Fi)
      return 'http://127.0.0.1:5000';
    }

    return 'http://localhost:5000';
  }

  /// Set URL yang terdeteksi secara otomatis jika koneksi berhasil
  static void setAutoDetectedUrl(String url) {
    _autoDetectedUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
  }

  /// Mengatur custom base URL (misalnya jika pengujian menggunakan HP fisik via Wi-Fi IP komputer)
  static Future<void> setCustomBaseUrl(String? url) async {
    final prefs = await SharedPreferences.getInstance();
    if (url == null || url.trim().isEmpty) {
      await prefs.remove(_prefKeyCustomBaseUrl);
      _cachedBaseUrl = null;
      _autoDetectedUrl = null;
    } else {
      final sanitized = url.trim().replaceAll(RegExp(r'/+$'), '');
      await prefs.setString(_prefKeyCustomBaseUrl, sanitized);
      _cachedBaseUrl = sanitized;
    }
  }

  /// Default Base URL sesuai platform lokal
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return 'http://localhost:5000';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://127.0.0.1:5000';
    }
    return 'http://localhost:5000';
  }

  // Auth Endpoints
  static String get loginUrl => '$baseUrl/api/auth/login';
  static String get profileUrl => '$baseUrl/api/auth/profile';

  // Attendance Endpoints
  static String get submitAttendanceUrl => '$baseUrl/api/attendance';
  static String get attendanceHistoryUrl => '$baseUrl/api/attendance/history';
  static String get todayAttendanceUrl => '$baseUrl/api/attendance/today';

  // Leave Request Endpoints
  static String get submitLeaveUrl => '$baseUrl/api/leaves';
  static String get myLeavesUrl => '$baseUrl/api/leaves/my';
  static String get todayLeaveUrl => '$baseUrl/api/leaves/today';

  // Health Endpoint
  static String get healthUrl => '$baseUrl/api/health';
}
