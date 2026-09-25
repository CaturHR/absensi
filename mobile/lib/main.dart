import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'config/api_constants.dart';
import 'services/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/history_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/home_screen.dart';
import 'screens/leave_screen.dart';

List<CameraDescription> cameras = [];

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inisialisasi API Constants (baca custom server URL jika ada)
  await ApiConstants.init();

  // Inisialisasi locale formatting Indonesia
  try {
    await initializeDateFormatting('id_ID', null);
  } catch (e) {
    debugPrint('Format tanggal id_ID gagal diinisialisasi: $e');
  }

  // Deteksi kamera perangkat
  try {
    cameras = await availableCameras();
  } catch (e) {
    debugPrint('Tidak dapat mendeteksi kamera saat startup: $e');
  }

  final bool loggedIn = await AuthService.isLoggedIn();

  runApp(AbsensiApp(isLoggedIn: loggedIn));
}

class AbsensiApp extends StatelessWidget {
  final bool isLoggedIn;

  const AbsensiApp({super.key, required this.isLoggedIn});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Presensi Biometrik Wajah',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF365C4A), // Forest Moss
          primary: const Color(0xFF365C4A),
        ),
        scaffoldBackgroundColor: const Color(0xFFF7F7F2),
        useMaterial3: true,
      ),
      home: isLoggedIn
          ? MainNavigationWrapper(cameras: cameras)
          : LoginScreen(cameras: cameras),
    );
  }
}

/// Wrapper navigasi utama dengan Bottom Navigation Bar
class MainNavigationWrapper extends StatefulWidget {
  final List<CameraDescription> cameras;

  const MainNavigationWrapper({super.key, required this.cameras});

  @override
  State<MainNavigationWrapper> createState() => _MainNavigationWrapperState();
}

class _MainNavigationWrapperState extends State<MainNavigationWrapper> {
  int _currentIndex = 0;
  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _pages = [
      HomeScreen(
        cameras: widget.cameras,
        onSwitchTab: (index) {
          setState(() => _currentIndex = index);
        },
      ),
      AttendanceScreen(cameras: widget.cameras),
      LeaveScreen(cameras: widget.cameras),
      const HistoryScreen(),
      ProfileScreen(cameras: widget.cameras),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        backgroundColor: Colors.white,
        elevation: 2,
        indicatorColor: const Color(0xFF365C4A).withValues(alpha: 0.15),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded, color: Color(0xFF365C4A)),
            label: 'Beranda',
          ),
          NavigationDestination(
            icon: Icon(Icons.camera_alt_outlined),
            selectedIcon: Icon(Icons.camera_alt, color: Color(0xFF365C4A)),
            label: 'Presensi',
          ),
          NavigationDestination(
            icon: Icon(Icons.description_outlined),
            selectedIcon: Icon(Icons.description_rounded, color: Color(0xFF6366F1)),
            label: 'Izin',
          ),
          NavigationDestination(
            icon: Icon(Icons.history_outlined),
            selectedIcon: Icon(Icons.history, color: Color(0xFF365C4A)),
            label: 'Riwayat',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: Color(0xFF365C4A)),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
