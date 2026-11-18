
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:remeeet/app/app.dart';
import 'package:remeeet/core/api.dart';
import 'package:remeeet/core/models.dart';
import 'package:remeeet/core/requests.dart';
import 'package:remeeet/core/settings.dart';
import 'package:remeeet/features/search/search_prefill.dart';
import 'package:remeeet/ui/common.dart';
import 'package:remeeet/ui/date_planner.dart';
import 'package:remeeet/ui/flight_card.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'helpers.dart';

/// A backend that answers from captured responses and remembers what it was asked.
class FakeApi extends RemeetApi {
  FakeApi() : super(Dio());
  final searches = <Json>[];
  final created = <Json>[];
  final deleted = <String>[];
  final patched = <(String, Json)>[];
  Watch? stored;

  @override
  Future<SearchResult> search(Json request, {CancelToken? cancel}) async {
    searches.add(request);
    return SearchResult.fromJson(fixture('search.json'));
  }

  @override
  Future<Watch> createWatch(Json body) async {
    created.add(body);
    return Watch.fromJson({...fixture('watch.json'), 'id': 'new-watch', 'label': body['label']});
  }

  @override
  Future<List<Watch>> watches() async => stored == null ? const [] : [stored!];

  @override
  Future<Watch?> getWatch(String id) async => stored;

  @override
  Future<Watch> patchWatch(String id, Json patch) async {
    patched.add((id, patch));
    return stored!;
  }

  @override
  Future<void> deleteWatch(String id) async {
    deleted.add(id);
    if (stored?.id == id) stored = null;
  }
}

Future<ProviderContainer> pumpApp(WidgetTester t, {FakeApi? api, Map<String, Object> prefs = const {}}) async {
  SharedPreferences.setMockInitialValues(prefs);
  final sp = await SharedPreferences.getInstance();
  t.view.physicalSize = const Size(1170, 3000);
  t.view.devicePixelRatio = 3;
  // The test font (Ahem) is about twice as wide as a real one; scale it down so layouts match a phone.
  t.platformDispatcher.textScaleFactorTestValue = 0.55;
  addTearDown(t.view.reset);
  addTearDown(t.platformDispatcher.clearAllTestValues);
  await t.pumpWidget(ProviderScope(overrides: [sharedPrefsProvider.overrideWithValue(sp), apiProvider.overrideWithValue(api ?? FakeApi())], child: const RemeetApp()));
  await t.pumpAndSettle();
  return ProviderScope.containerOf(t.element(find.byType(RemeetApp)));
}

SearchPrefill waw2bcn() => SearchPrefill(
      from: const Airport(iata: 'WAW', name: 'Chopin', city: 'Warsaw', country: 'PL'),
      to: const Airport(iata: 'BCN', name: 'El Prat', city: 'Barcelona', country: 'ES'),
      dates: DatePlan.initial(now: DateTime(2026, 11, 15)),
      party: const Party(),
    );

/// The page scrolls in its first (outer) Scrollable; the chip rows inside are scrollables too.
Future<void> scrollTo(WidgetTester t, Finder f) async {
  // The list builds its rows lazily, so keep scrolling until the wanted one exists.
  for (var i = 0; i < 30 && f.evaluate().isEmpty; i++) {
    await t.drag(find.byType(Scrollable).first, const Offset(0, -400));
    await t.pump();
  }
  expect(f, findsWidgets, reason: 'never found after scrolling');
  await t.ensureVisible(f.first);
  await t.pumpAndSettle();
}

void main() {
  setUpAll(() => initializeDateFormatting());

  testWidgets('starts on the search tab with the five tabs', (t) async {
    await pumpApp(t);
    expect(find.text('Квитки, що поважають ваші вихідні'), findsOneWidget);
    for (final label in ['Пошук', 'Куди', 'Зустріч', 'Відстеження', 'Ще']) {
      expect(find.text(label), findsWidgets, reason: label);
    }
  });

  testWidgets('searching without airports asks for them', (t) async {
    final api = FakeApi();
    await pumpApp(t, api: api);
    await scrollTo(t, find.text('Знайти'));
    await t.tap(find.text('Знайти'));
    await t.pumpAndSettle();
    expect(find.text('Оберіть аеропорти зі списку.'), findsOneWidget);
    expect(api.searches, isEmpty);
  });

  testWidgets('a handed-over search fills the form, runs, and shows the results', (t) async {
    final api = FakeApi();
    final c = await pumpApp(t, api: api);
    c.read(searchPrefillProvider.notifier).request(waw2bcn());
    await t.pumpAndSettle();
    expect(api.searches, hasLength(1));
    final req = api.searches.single;
    expect(req['origin'], 'WAW');
    expect(req['destination'], 'BCN');
    expect(req['returnDate'], isNotNull);
    expect(req['filters'], isNotNull, reason: 'civilised hours are on by default');
    await scrollTo(t, find.byType(FlightCard));
    expect(find.byType(FlightCard), findsWidgets);
    expect(find.textContaining('3 результатів'), findsOneWidget);
    expect(c.read(searchPrefillProvider), isNull, reason: 'the hand-over is consumed');
  });

  testWidgets('tracking a result creates a tracker', (t) async {
    final api = FakeApi();
    final c = await pumpApp(t, api: api);
    c.read(searchPrefillProvider.notifier).request(waw2bcn());
    await t.pumpAndSettle();
    await scrollTo(t, find.text('Відстежувати'));
    await t.tap(find.text('Відстежувати').first);
    await t.pumpAndSettle();
    await t.tap(find.text('Зберегти'));
    await t.pumpAndSettle();
    expect(api.created, hasLength(1));
    final body = api.created.single;
    expect((body['params'] as Map)['kind'], 'search');
    expect(((body['params'] as Map)['request'] as Map)['origin'], 'WAW');
    expect(body['targetPrice'], greaterThan(0));
    expect(find.text('Відстеження створено'), findsOneWidget);
  });

  testWidgets('language switches between Ukrainian and English', (t) async {
    final c = await pumpApp(t);
    await t.tap(find.text('Ще'));
    await t.pumpAndSettle();
    await t.tap(find.text('English'));
    await t.pumpAndSettle();
    expect(c.read(settingsProvider).lang, 'en');
    expect(find.text('LANGUAGE'), findsOneWidget);
    expect(find.text('Search'), findsWidgets);
    expect(find.text('Privacy Policy'), findsOneWidget);
    expect(find.textContaining('Pavlenko'), findsOneWidget);
  });

  testWidgets('the saved language is restored', (t) async {
    await pumpApp(t, prefs: {'lang': 'en'});
    expect(find.text('Tickets that respect your weekend'), findsOneWidget);
  });

  testWidgets('the owner’s trackers are listed and can be deleted', (t) async {
    final api = FakeApi()..stored = Watch.fromJson({...fixture('watch.json'), 'id': 'w1'});
    await pumpApp(t, api: api);
    await t.tap(find.text('Відстеження').last);
    await t.pumpAndSettle();
    expect(find.text('fixture'), findsOneWidget);
    expect(find.text('Підключити Telegram'), findsOneWidget);
    await t.tap(find.byIcon(Icons.delete_outline));
    await t.pumpAndSettle();
    expect(find.textContaining('Видалити відстеження'), findsOneWidget);
    await t.tap(find.text('Видалити').last);
    await t.pumpAndSettle();
    expect(api.deleted, ['w1']);
    expect(find.text('fixture'), findsNothing);
  });

  testWidgets('the tracking tab explains itself when there is nothing yet', (t) async {
    await pumpApp(t);
    await t.tap(find.text('Відстеження').last);
    await t.pumpAndSettle();
    expect(find.textContaining('Ще немає відстежень'), findsOneWidget);
  });

  testWidgets('the meetup planner needs two friends with airports', (t) async {
    await pumpApp(t);
    await t.tap(find.text('Зустріч').last);
    await t.pumpAndSettle();
    expect(find.text('Хто летить'), findsOneWidget);
    await scrollTo(t, find.text('Підібрати'));
    await t.tap(find.text('Підібрати'));
    await t.pumpAndSettle();
    await scrollTo(t, find.text('Додайте щонайменше двох друзів з аеропортами.'));
    expect(find.text('Додайте щонайменше двох друзів з аеропортами.'), findsOneWidget);
  });

  testWidgets('the explore tab opens with its form', (t) async {
    await pumpApp(t);
    await t.tap(find.text('Куди').last);
    await t.pumpAndSettle();
    expect(find.text('Куди завгодно'), findsOneWidget);
    expect(find.text('Лише прямі рейси'), findsOneWidget);
  });

  testWidgets('the submit button keeps its width while it is working', (t) async {
    Widget host(bool loading) => MaterialApp(home: Scaffold(body: Center(child: SubmitButton(icon: Icons.search, idle: 'Знайти', busy: 'Шукаємо…', loading: loading, onPressed: () {}))));
    await t.pumpWidget(host(false));
    final idle = t.getSize(find.byType(FilledButton));
    await t.pumpWidget(host(true));
    await t.pump();
    final busy = t.getSize(find.byType(FilledButton));
    expect(busy.width, idle.width);
    expect(busy.height, idle.height);
    expect(idle.width, greaterThan(100));
  });
}
