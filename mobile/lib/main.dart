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

/// Wrapper navigasi utama dengan Bottom Navigation Bar dan animasi transisi geser kaca modern (Liquid Glass Depth Transition)
class MainNavigationWrapper extends StatefulWidget {
  final List<CameraDescription> cameras;

  const MainNavigationWrapper({super.key, required this.cameras});

  @override
  State<MainNavigationWrapper> createState() => _MainNavigationWrapperState();
}

class _MainNavigationWrapperState extends State<MainNavigationWrapper> {
  int _currentIndex = 0;
  late final PageController _pageController;
  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
    _pages = [
      HomeScreen(
        cameras: widget.cameras,
        onSwitchTab: (index) {
          _onTabSelected(index);
        },
      ),
      AttendanceScreen(cameras: widget.cameras),
      LeaveScreen(cameras: widget.cameras),
      const HistoryScreen(),
      ProfileScreen(cameras: widget.cameras),
    ];
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Pindah halaman dengan animasi kurva lereng halus (easeOutCubic) saat tab diklik
  void _onTabSelected(int index) {
    if (_currentIndex == index) return;
    setState(() => _currentIndex = index);
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 380),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: PageView.builder(
        controller: _pageController,
        physics: const BouncingScrollPhysics(),
        itemCount: _pages.length,
        onPageChanged: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        itemBuilder: (context, index) {
          return AnimatedBuilder(
            animation: _pageController,
            builder: (context, child) {
              double value = 0.0;
              if (_pageController.position.haveDimensions) {
                value = (_pageController.page ?? _pageController.initialPage.toDouble()) - index;
              } else {
                value = (_pageController.initialPage - index).toDouble();
              }

              // Hitung jarak penyimpangan dari halaman aktif (0.0 = fokus penuh)
              final double delta = value.abs().clamp(0.0, 1.0);

              // Animasi Kedalaman Skala Kaca (1.0 turun ke 0.93 saat digeser)
              final double scale = 1.0 - (delta * 0.07);

              // Animasi Kelembutan Opacity (1.0 turun ke 0.70)
              final double opacity = 1.0 - (delta * 0.30);

              return Transform.scale(
                scale: scale,
                child: Opacity(
                  opacity: opacity.clamp(0.0, 1.0),
                  child: child,
                ),
              );
            },
            child: _pages[index],
          );
        },
      ),
      bottomNavigationBar: LiquidGlassNavBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: _onTabSelected,
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
