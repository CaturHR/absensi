import 'package:geolocator/geolocator.dart';

class MockLocationDetectedException implements Exception {
  final String message;
  MockLocationDetectedException([this.message = 'Lokasi palsu (Fake GPS / Mock Location) terdeteksi! Harap gunakan GPS asli.']);

  @override
  String toString() => message;
}

class LocationService {
  /// Mengambil posisi GPS pengguna saat ini dan memvalidasi keaslian GPS.
  /// Melempar [MockLocationDetectedException] jika terdeteksi Fake GPS.
  static Future<Position> getCurrentPosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    // 1. Cek apakah layanan GPS aktif di perangkat
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw Exception('Layanan lokasi (GPS) pada perangkat belum aktif. Harap aktifkan GPS Anda.');
    }

    // 2. Cek izin akses lokasi aplikasi
    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw Exception('Izin akses lokasi ditolak oleh pengguna.');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw Exception(
        'Izin akses lokasi ditolak secara permanen. Harap aktifkan izin di menu Pengaturan aplikasi Anda.',
      );
    }

    // 3. Ambil koordinat GPS akurasi tinggi
    final position = await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      timeLimit: const Duration(seconds: 15),
    );

    // 4. Validasi Anti-Fake GPS / Mock Location
    if (position.isMocked) {
      throw MockLocationDetectedException();
    }

    return position;
  }
}
