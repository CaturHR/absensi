import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/api_constants.dart';
import '../services/auth_service.dart';
import '../widgets/liquid_glass.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, String> _userData = {
    'name': '...',
    'nip': '...',
    'email': '...',
    'role': '...',
    'divisi': '...',
  };
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    final localData = await AuthService.getUserData();
    if (mounted) {
      setState(() {
        _userData = localData;
        _isLoading = false;
      });
    }

    // Ambil data terbaru dari server
    final serverData = await AuthService.fetchProfile();
    if (serverData != null && mounted) {
      final updatedLocal = await AuthService.getUserData();
      setState(() {
        _userData = updatedLocal;
      });
    }
  }

  Future<void> _handleLogout() async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Konfirmasi Logout'),
        content: const Text('Apakah Anda yakin ingin keluar dari akun ini?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade600,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Keluar'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    await AuthService.logout();

    if (!mounted) return;

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => const LoginScreen()),
      (route) => false,
    );
  }

  void _showServerSettingsDialog() {
    final controller = TextEditingController(text: ApiConstants.baseUrl);
    String? testStatus;
    bool isTesting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.dns_outlined, color: Color(0xFF365C4A)),
              SizedBox(width: 8),
              Text(
                'Pengaturan Server Backend',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Pilih preset koneksi lokal atau masukkan URL manual:',
                  style: TextStyle(fontSize: 12, color: Colors.black54),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    ActionChip(
                      label: const Text('Wi-Fi PC (10.66.109.229)', style: TextStyle(fontSize: 11)),
                      avatar: const Icon(Icons.wifi, size: 14),
                      onPressed: () {
                        setDialogState(() {
                          controller.text = 'http://10.66.109.229:5000';
                          testStatus = null;
                        });
                      },
                    ),
                    ActionChip(
                      label: const Text('USB ADB (127.0.0.1)', style: TextStyle(fontSize: 11)),
                      avatar: const Icon(Icons.usb, size: 14),
                      onPressed: () {
                        setDialogState(() {
                          controller.text = 'http://127.0.0.1:5000';
                          testStatus = null;
                        });
                      },
                    ),
                    ActionChip(
                      label: const Text('Emulator (10.0.2.2)', style: TextStyle(fontSize: 11)),
                      avatar: const Icon(Icons.phone_android, size: 14),
                      onPressed: () {
                        setDialogState(() {
                          controller.text = 'http://10.0.2.2:5000';
                          testStatus = null;
                        });
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: controller,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'URL Server Backend',
                    hintText: 'http://10.66.109.229:5000',
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    OutlinedButton.icon(
                      icon: isTesting
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.network_check, size: 16),
                      label: const Text('Cek Koneksi', style: TextStyle(fontSize: 12)),
                      onPressed: isTesting
                          ? null
                          : () async {
                              setDialogState(() {
                                isTesting = true;
                                testStatus = null;
                              });
                              try {
                                final clean = controller.text.trim().replaceAll(RegExp(r'/+$'), '');
                                final res = await http
                                    .get(Uri.parse('$clean/api/health'))
                                    .timeout(const Duration(seconds: 3));
                                setDialogState(() {
                                  isTesting = false;
                                  testStatus = res.statusCode == 200
                                      ? '✅ Terhubung! Server aktif.'
                                      : '⚠️ Respon kode: ${res.statusCode}';
                                });
                              } catch (e) {
                                setDialogState(() {
                                  isTesting = false;
                                  testStatus = '❌ Gagal: $e';
                                });
                              }
                            },
                    ),
                  ],
                ),
                if (testStatus != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    testStatus!,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: testStatus!.startsWith('✅') ? Colors.green.shade700 : Colors.red.shade700,
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () async {
                await ApiConstants.setCustomBaseUrl(null);
                if (ctx.mounted) {
                  Navigator.pop(ctx);
                  setState(() {});
                }
              },
              child: const Text('Reset'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF365C4A),
                foregroundColor: Colors.white,
              ),
              onPressed: () async {
                await ApiConstants.setCustomBaseUrl(controller.text);
                if (ctx.mounted) {
                  Navigator.pop(ctx);
                  setState(() {});
                }
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
    Color? iconColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: (iconColor ?? const Color(0xFF365C4A)).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: iconColor ?? const Color(0xFF365C4A), size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(fontSize: 11, color: Colors.black45, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      extendBodyBehindAppBar: true,
      appBar: const LiquidGlassAppBar(
        title: 'Profil Karyawan',
        automaticallyImplyLeading: false,
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background Wallpaper
          Image.asset(
            'lib/asset/baground/BG.png',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(color: const Color(0xFF365C4A)),
          ),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.25),
                  Colors.black.withValues(alpha: 0.10),
                  Colors.black.withValues(alpha: 0.35),
                ],
              ),
            ),
          ),

          SafeArea(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator(color: Colors.white))
                : SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const SizedBox(height: 12),

                        // Avatar & Name Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 20),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.94),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.08),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                            border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
                          ),
                          child: Column(
                            children: [
                              Container(
                                width: 84,
                                height: 84,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF365C4A).withValues(alpha: 0.15),
                                  shape: BoxShape.circle,
                                  border: Border.all(color: const Color(0xFF365C4A), width: 2),
                                ),
                                child: Center(
                                  child: Text(
                                    (_userData['name'] ?? 'U').isNotEmpty
                                        ? (_userData['name'] ?? 'U')[0].toUpperCase()
                                        : 'U',
                                    style: const TextStyle(
                                      fontSize: 36,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF365C4A),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              Text(
                                _userData['name'] ?? '-',
                                style: const TextStyle(
                                  fontSize: 19,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF365C4A).withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  'NIP: ${_userData['nip'] ?? "-"}',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF365C4A),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 20),

                        // Details Card
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.94),
                            borderRadius: BorderRadius.circular(24),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.08),
                                blurRadius: 16,
                                offset: const Offset(0, 4),
                              ),
                            ],
                            border: Border.all(color: Colors.white.withValues(alpha: 0.8)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Informasi Akun',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF1E293B),
                                ),
                              ),
                              const SizedBox(height: 14),
                              _buildInfoRow(
                                icon: Icons.mail_outline_rounded,
                                label: 'Email / Username',
                                value: _userData['email'] ?? '-',
                                iconColor: const Color(0xFF2563EB),
                              ),
                              const SizedBox(height: 10),
                              _buildInfoRow(
                                icon: Icons.badge_outlined,
                                label: 'Nomor Induk Pegawai (NIP)',
                                value: _userData['nip'] ?? '-',
                                iconColor: const Color(0xFF10B981),
                              ),
                              const SizedBox(height: 10),
                              _buildInfoRow(
                                icon: Icons.business_rounded,
                                label: 'Divisi / Departemen',
                                value: _userData['divisi'] ?? 'Umum',
                                iconColor: const Color(0xFFF59E0B),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16),

                        // Server Settings Button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: OutlinedButton.icon(
                            onPressed: _showServerSettingsDialog,
                            icon: const Icon(Icons.dns_outlined, size: 20, color: Color(0xFF365C4A)),
                            label: const Text(
                              'Pengaturan Server Backend',
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF365C4A),
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              backgroundColor: Colors.white.withValues(alpha: 0.9),
                              side: const BorderSide(color: Color(0xFF365C4A), width: 1.5),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Logout Button
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _handleLogout,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.red.shade600,
                              foregroundColor: Colors.white,
                              elevation: 2,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.logout_rounded, size: 20),
                                SizedBox(width: 8),
                                Text(
                                  'Keluar (Logout)',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                        ),

                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
