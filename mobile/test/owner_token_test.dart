import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:remeeet/core/api.dart';
import 'package:remeeet/core/owner_token.dart';

import 'api_test.dart' show FakeAdapter, json;

class MemoryStorage implements TokenStorage {
  MemoryStorage([this.value]);
  String? value;
  int writes = 0;

  @override
  Future<String?> read() async => value;

  @override
  Future<void> write(String token) async {
    writes++;
    value = token;
  }
}

class BrokenStorage implements TokenStorage {
  @override
  Future<String?> read() async => throw Exception('keychain locked');

  @override
  Future<void> write(String token) async => throw Exception('keychain locked');
}

final _serverFormat = RegExp(r'^[A-Za-z0-9_-]{32,128}$');

void main() {
  test('generated tokens match the server format and differ every time', () {
    final a = generateOwnerToken();
    expect(a, matches(_serverFormat));
    expect(a.length, 43);
    expect(generateOwnerToken(), isNot(a));
  });

  test('the first launch creates and saves a token, later launches reuse it', () async {
    final storage = MemoryStorage();
    final first = await loadOrCreateOwnerToken(storage);
    expect(storage.value, first);
    expect(await loadOrCreateOwnerToken(storage), first);
    expect(storage.writes, 1);
  });

  test('a damaged saved value is replaced', () async {
    final storage = MemoryStorage('bad value!');
    final t = await loadOrCreateOwnerToken(storage, Random(1));
    expect(t, matches(_serverFormat));
    expect(storage.value, t);
  });

  test('an unavailable secure storage does not stop the app', () async {
    final t = await loadOrCreateOwnerToken(BrokenStorage());
    expect(t, matches(_serverFormat));
  });

  test('every request carries the Bearer token', () async {
    final adapter = FakeAdapter((o) => json([]));
    final dio = Dio(BaseOptions(baseUrl: 'http://test'))
      ..httpClientAdapter = adapter
      ..interceptors.add(OwnerTokenInterceptor('t' * 40));
    await RemeetApi(dio).deleteWatch('a');
    expect(adapter.seen.single.headers['authorization'], 'Bearer ${'t' * 40}');
  });

  test('without a token no header is sent', () async {
    final adapter = FakeAdapter((o) => json([]));
    final dio = Dio(BaseOptions(baseUrl: 'http://test'))
      ..httpClientAdapter = adapter
      ..interceptors.add(OwnerTokenInterceptor(''));
    await RemeetApi(dio).deleteWatch('a');
    expect(adapter.seen.single.headers.containsKey('authorization'), isFalse);
  });

  test('the app client uses the token from the provider', () {
    final c = ProviderContainer(overrides: [ownerTokenProvider.overrideWithValue('x' * 43)]);
    addTearDown(c.dispose);
    expect(c.read(dioProvider).interceptors.whereType<OwnerTokenInterceptor>().single.token, 'x' * 43);
  });
}
