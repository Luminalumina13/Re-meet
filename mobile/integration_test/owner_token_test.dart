import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:remeeet/core/api.dart';
import 'package:remeeet/core/config.dart';
import 'package:remeeet/core/owner_token.dart';

/// Real Keychain/Keystore + live backend (API_BASE_URL):
///   flutter test integration_test/owner_token_test.dart --dart-define=API_BASE_URL=http://localhost:3060 -d SIMULATOR_ID
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('the token survives in secure storage and unlocks only its own tracker', (t) async {
    final first = await loadOrCreateOwnerToken(const SecureTokenStorage());
    expect(await loadOrCreateOwnerToken(const SecureTokenStorage()), first);

    final c = ProviderContainer(overrides: [ownerTokenProvider.overrideWithValue(first)]);
    addTearDown(c.dispose);
    final api = c.read(apiProvider);
    final created = await api.createWatch({
      'label': 'e2e token',
      'params': {
        'kind': 'search',
        'request': {'origin': 'WAW', 'destination': 'BCN', 'departDate': '2026-12-05', 'adults': 1, 'cabin': 'economy', 'currency': 'EUR'},
      },
    });
    expect((await api.watches()).map((w) => w.id), contains(created.id));
    expect((await api.getWatch(created.id))?.id, created.id);

    // Somebody else (no token) gets "not found".
    final stranger = RemeetApi(Dio(BaseOptions(baseUrl: apiBaseUrl)));
    expect(await stranger.getWatch(created.id), isNull);
    expect(await stranger.watches(), isEmpty);

    await api.deleteWatch(created.id);
  });
}
