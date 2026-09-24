import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../config/api_constants.dart';

class AuthService {
  /// Melakukan login ke backend Express.js dengan Email/NIP dan Password
  /// Endpoint: POST /api/auth/login
  static Future<Map<String, dynamic>> login({
    required String identifier, // Email atau NIP
    required String password,
  }) async {
    final uri = Uri.parse(ApiConstants.loginUrl);

    try {
      // Backend Express menerima { email, password } atau { nip, password }
      final isEmail = identifier.contains('@');
      final body = jsonEncode({
        if (isEmail) 'email': identifier else 'nip': identifier,
        'password': password,
      });

      final response = await http.post(
        uri,
        headers: {'Content-Type': 'application/json'},
        body: body,
      ).timeout(const Duration(seconds: 15));

      final Map<String, dynamic> data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        final token = data['token'] ?? data['data']?['token'];
        final user = data['user'] ?? data['data']?['user'] ?? {};

        // Simpan token JWT dan identitas user ke SharedPreferences
        final prefs = await SharedPreferences.getInstance();
        if (token != null) {
          await prefs.setString('auth_token', token.toString());
        }
        await prefs.setString('user_name', user['name']?.toString() ?? 'Karyawan');
        await prefs.setString('user_nip', user['nip']?.toString() ?? identifier);
        await prefs.setString('user_email', user['email']?.toString() ?? '');

        return {'success': true, 'data': data};
      } else {
        return {
          'success': false,
          'message': data['message'] ?? 'Login gagal. Periksa kembali NIP/Email dan kata sandi Anda.',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Gagal menghubungi server: $e',
      };
    }
  }

  /// Cek apakah user sudah login sebelumnya
  static Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');
    return token != null && token.isNotEmpty;
  }

  /// Logout dan hapus token
  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }
}
