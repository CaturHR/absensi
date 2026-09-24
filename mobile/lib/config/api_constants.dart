import 'package:flutter/foundation.dart';
import 'dart:io' show Platform;

class ApiConstants {
  // Gunakan localhost untuk Web & iOS, 10.0.2.2 untuk Android Emulator, atau IP LAN komputer Anda
  static String get baseUrl {
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

  // Attendance Endpoints
  static String get submitAttendanceUrl => '$baseUrl/api/attendance';
  static String get attendanceHistoryUrl => '$baseUrl/api/attendance/history';
}
