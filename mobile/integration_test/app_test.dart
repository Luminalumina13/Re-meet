import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:remeeet/main.dart' as app;
import 'package:remeeet/ui/flight_card.dart';

/// End-to-end run against a live backend (API_BASE_URL, default https://remeeet.com):
///   flutter test integration_test --dart-define=API_BASE_URL=http://localhost:3000 -d SIMULATOR_ID
/// Screenshots go to SHOTS_DIR when it is set.
const _shots = String.fromEnvironment('SHOTS_DIR');

Future<void> pumpUntil(WidgetTester t, Finder f, {Duration timeout = const Duration(seconds: 90)}) async {
  final end = DateTime.now().add(timeout);
  while (f.evaluate().isEmpty) {
    if (DateTime.now().isAfter(end)) fail('timed out waiting for $f');
    await t.pump(const Duration(milliseconds: 300));
  }
}

Future<void> shot(IntegrationTestWidgetsFlutterBinding b, WidgetTester t, String name) async {
  if (_shots.isEmpty) return;
  await t.pumpAndSettle(const Duration(milliseconds: 500));
  final bytes = await b.takeScreenshot(name);
  File('$_shots/$name.png').writeAsBytesSync(bytes);
}

/// The page builds rows lazily: scroll the outer list until [f] exists, then bring it into view.
Future<void> scrollTo(WidgetTester t, Finder f) async {
  for (var i = 0; i < 40 && f.evaluate().isEmpty; i++) {
    await t.drag(find.byType(Scrollable).first, const Offset(0, -400));
    await t.pump(const Duration(milliseconds: 100));
  }
  await t.ensureVisible(f.first);
  await t.pumpAndSettle();
}

Future<void> pickAirport(WidgetTester t, int fieldIndex, String typed, String optionPrefix) async {
  final field = find.byType(TextField).at(fieldIndex);
  await t.ensureVisible(field);
  await t.pumpAndSettle();
  await t.enterText(field, typed);
  final option = find.textContaining(optionPrefix);
  await pumpUntil(t, option, timeout: const Duration(seconds: 15));
  await t.tap(option.first);
  await t.pumpAndSettle();
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('search WAW → BCN end to end', (t) async {
    await app.main();
    await t.pumpAndSettle();
    await shot(binding, t, '01_search_empty');

    await pickAirport(t, 0, 'Warsaw', 'Warsaw ·');
    await pickAirport(t, 1, 'Barcelona', 'Barcelona ·');
    await shot(binding, t, '02_search_filled');

    final submit = find.text('Знайти');
    await scrollTo(t, submit);
    await t.tap(submit);
    await pumpUntil(t, find.byType(FlightCard));
    await t.pumpAndSettle();
    expect(find.byType(FlightCard), findsWidgets);
    expect(find.textContaining('результатів'), findsOneWidget);
    await t.drag(find.byType(Scrollable).first, const Offset(0, -900));
    await t.pumpAndSettle();
    await shot(binding, t, '03_search_results');
  });

  testWidgets('flexible dates fill in from the live API', (t) async {
    await app.main();
    await t.pumpAndSettle();
    await pickAirport(t, 0, 'Warsaw', 'Warsaw ·');
    await pickAirport(t, 1, 'Barcelona', 'Barcelona ·');
    final show = find.text('Показати ціни');
    await scrollTo(t, show);
    await t.tap(show);
    await pumpUntil(t, find.textContaining('Найдешевше:'), timeout: const Duration(seconds: 150));
    await t.pumpAndSettle(const Duration(seconds: 5));
    await shot(binding, t, '04_flex');
    expect(find.textContaining('Найдешевше:'), findsOneWidget);
  });

  testWidgets('tabs: anywhere, meetup, tracking, settings', (t) async {
    await app.main();
    await t.pumpAndSettle();
    for (final (label, name) in [('Куди', '05_explore'), ('Зустріч', '06_meetup'), ('Відстеження', '07_tracking'), ('Ще', '08_more')]) {
      await t.tap(find.text(label).last);
      await t.pumpAndSettle();
      await shot(binding, t, name);
    }
    expect(find.text('Політика конфіденційності'), findsOneWidget);
  });
}
