import 'package:flutter_test/flutter_test.dart';
import 'package:absensi_mobile/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const AbsensiApp(isLoggedIn: false));
    expect(find.text('Presensi Pegawai'), findsOneWidget);
  });
}
