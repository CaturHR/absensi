import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class ApiConstants {
  static const String _prefKeyCustomBaseUrl = 'custom_base_url';
  static String? _cachedBaseUrl;
  static String? _autoDetectedUrl;

  /// IP Wi-Fi PC saat ini (dapat diakses langsung oleh HP fisik di jaringan Wi-Fi yang sama)
  static const String currentWifiIp = '192.168.1.52';

  /// Daftar kandidat URL lokal untuk pengujian Android / Desktop / Web
  static const List<String> localAndroidCandidates = [
    'http://192.168.1.52:5000', // Wi-Fi LAN IP PC (Sangat cocok untuk HP fisik via Wi-Fi)
    'http://127.0.0.1:5000',    // Port forwarding USB via ADB reverse (Sangat Stabil)
    'http://10.0.2.2:5000',     // Android Studio Emulator
    'http://localhost:5000',    // Localhost loopback
  ];

  /// Inisialisasi API Constants (memuat baseUrl tersimpan dari SharedPreferences jika ada)
  static Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _cachedBaseUrl = prefs.getString(_prefKeyCustomBaseUrl);

    // Jika di Android dan nilai tersimpan adalah localhost, hapus karena localhost di Android mengarah ke HP sendiri
    if (!kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android &&
        _cachedBaseUrl != null &&
        _cachedBaseUrl!.contains('localhost')) {
      _cachedBaseUrl = null;
      await prefs.remove(_prefKeyCustomBaseUrl);
    }

    // Jalankan auto-detect untuk menemukan server lokal yang aktif merespon
    _autoDetectedUrl = await detectBestUrl();
  }

  /// Cek kandidat URL lokal yang aktif dan merespon /api/health secara paralel
  static Future<String?> detectBestUrl() async {
    final List<String> testList = [
      if (_cachedBaseUrl != null && _cachedBaseUrl!.isNotEmpty) _cachedBaseUrl!,
      ...localAndroidCandidates,
    ];

    final seen = <String>{};
    final uniqueCandidates = testList
        .map((c) => c.trim().replaceAll(RegExp(r'/+$'), ''))
        .where((c) => c.isNotEmpty && seen.add(c))
        .toList();

    // Tes semua kandidat secara paralel dengan batas waktu 2 detik
    final futures = uniqueCandidates.map((candidate) async {
      try {
        final uri = Uri.parse('$candidate/api/health');
        final res = await http.get(uri).timeout(const Duration(milliseconds: 2000));
        if (res.statusCode == 200) {
          return candidate;
        }
      } catch (_) {}
      return null;
    });

    final results = await Future.wait(futures);
    for (final res in results) {
      if (res != null) {
        _autoDetectedUrl = res;
        return res;
      }
    }
    return null;
  }

  /// Base URL aktif (prioritas: hasil auto-detect yang merespon > custom URL pengguna > default platform)
  static String get baseUrl {
    // 1. Jika auto-detect telah menemukan URL yang aktif dan terbukti merespon
    if (_autoDetectedUrl != null && _autoDetectedUrl!.trim().isNotEmpty) {
      return _autoDetectedUrl!.trim().replaceAll(RegExp(r'/+$'), '');
    }

    // 2. Custom URL manual dari user (jika bukan localhost di Android)
    if (_cachedBaseUrl != null && _cachedBaseUrl!.trim().isNotEmpty) {
      final cached = _cachedBaseUrl!.trim().replaceAll(RegExp(r'/+$'), '');
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android && cached.contains('localhost')) {
        return 'http://$currentWifiIp:5000';
      }
      return cached;
    }

    // 3. Web browser
    if (kIsWeb) {
      try {
        final host = Uri.base.host;
        if (host.isNotEmpty && host != 'localhost' && host != '127.0.0.1') {
          return 'http://$host:5000';
        }
      } catch (_) {}
      return 'http://localhost:5000';
    }

    // 4. Android platform default (Gunakan IP Wi-Fi agar HP fisik langsung terhubung)
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://$currentWifiIp:5000';
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
      _autoDetectedUrl = sanitized;
    }
  }

  /// Default Base URL sesuai platform lokal
  static String get defaultBaseUrl {
    if (kIsWeb) {
      return 'http://localhost:5000';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://$currentWifiIp:5000';
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
