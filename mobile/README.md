# Aplikasi Mobile Absensi Karyawan (Flutter)

Aplikasi mobile Flutter untuk presensi karyawan dengan verifikasi biometrik wajah (kamera depan) dan geofencing GPS akurat yang terhubung ke Backend Express.js (`POST /api/attendance`).

---

## 🛠️ Dependensi Utama (`pubspec.yaml`)
- `camera`: Mengakses kamera depan dan mengambil foto selfie wajah.
- `geolocator`: Mendeteksi koordinat GPS pengguna dan validasi `isMocked` (blokir Fake GPS / Mock Location).
- `http`: Mengirimkan request multipart form-data (foto + koordinat) dan Bearer token JWT.
- `shared_preferences`: Menyimpan token autentikasi JWT dan identitas pengguna secara lokal.
- `intl`: Format tanggal dan jam Indonesia.

---

## 📱 Konfigurasi Izin Perangkat (Permissions)

### Android (`android/app/src/main/AndroidManifest.xml`)
Tambahkan izin berikut di dalam tag `<manifest>`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
```

### iOS (`ios/Runner/Info.plist`)
Tambahkan key berikut di dalam `<dict>`:
```xml
<key>NSCameraUsageDescription</key>
<string>Aplikasi membutuhkan akses kamera untuk mengambil foto verifikasi wajah saat presensi.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Aplikasi membutuhkan akses lokasi untuk memvalidasi radius kantor saat absensi.</string>
```

---

## 🚀 Menjalankan Aplikasi

1. **Jalankan Backend Express.js**:
   ```bash
   cd ../backend
   npm run dev
   ```

2. **Jalankan Aplikasi Flutter**:
   ```bash
   cd mobile
   flutter pub get
   flutter run
   ```

> **Catatan Koneksi Backend (`lib/config/api_constants.dart`)**:
> - Pada Android Emulator: gunakan `http://10.0.2.2:5000` (sudah dikonfigurasi otomatis).
> - Pada iOS Simulator: gunakan `http://localhost:5000`.
> - Pada Perangkat Fisik (HP): ubah URL menggunakan IP lokal komputer (misal: `http://192.168.1.10:5000`).
