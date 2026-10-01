import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'config/api_constants.dart';
import 'services/auth_service.dart';
import 'widgets/liquid_glass.dart';
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
      title: 'AbsenKita',
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
      extendBody: true,
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: LiquidGlassNavBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        destinations: const [
          LiquidNavItem(
            icon: Icons.home_outlined,
            selectedIcon: Icons.home_rounded,
            label: 'Beranda',
          ),
          LiquidNavItem(
            icon: Icons.camera_alt_outlined,
            selectedIcon: Icons.camera_alt_rounded,
            label: 'Presensi',
          ),
          LiquidNavItem(
            icon: Icons.description_outlined,
            selectedIcon: Icons.description_rounded,
            label: 'Izin',
          ),
          LiquidNavItem(
            icon: Icons.history_outlined,
            selectedIcon: Icons.history_rounded,
            label: 'Riwayat',
          ),
          LiquidNavItem(
            icon: Icons.person_outline,
            selectedIcon: Icons.person_rounded,
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
