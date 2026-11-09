import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'config/api_constants.dart';
import 'widgets/liquid_glass.dart';
import 'screens/splash_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/history_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/home_screen.dart';
import 'screens/leave_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inisialisasi API Constants
  await ApiConstants.init();

  // Inisialisasi locale formatting Indonesia
  try {
    await initializeDateFormatting('id_ID', null);
  } catch (e) {
    debugPrint('Format tanggal id_ID gagal diinisialisasi: $e');
  }

  runApp(const AbsensiApp());
}

class AbsensiApp extends StatelessWidget {
  const AbsensiApp({super.key});

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
      home: const SplashScreen(),
    );
  }
}

/// Wrapper navigasi utama dengan Bottom Navigation Bar dan Liquid Glass Depth Transition
class MainNavigationWrapper extends StatefulWidget {
  const MainNavigationWrapper({super.key});

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
        onSwitchTab: (index) {
          _onTabSelected(index);
        },
      ),
      const AttendanceScreen(),
      const LeaveScreen(),
      const HistoryScreen(),
      const ProfileScreen(),
    ];
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

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

              final double delta = value.abs().clamp(0.0, 1.0);
              final double scale = 1.0 - (delta * 0.07);
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
            icon: Icons.fingerprint_outlined,
            selectedIcon: Icons.fingerprint_rounded,
            label: 'Absen',
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
