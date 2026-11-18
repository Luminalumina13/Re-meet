import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The backend has no accounts: a tracker belongs to whoever holds the secret token it was created with.
/// The app makes one on first launch, keeps it in the Keychain / Keystore and sends it as `Authorization: Bearer`.
/// Losing it (new phone, app reinstalled on Android without backup) means losing access to the trackers.
const _storageKey = 'owner_token';

/// 32 random bytes, URL-safe (43 chars): matches what the server accepts (`[A-Za-z0-9_-]{32,128}`).
String generateOwnerToken([Random? random]) {
  final r = random ?? Random.secure();
  return base64Url.encode(List<int>.generate(32, (_) => r.nextInt(256))).replaceAll('=', '');
}

abstract class TokenStorage {
  Future<String?> read();
  Future<void> write(String token);
}

class SecureTokenStorage implements TokenStorage {
  const SecureTokenStorage([this._storage = const FlutterSecureStorage()]);
  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: _storageKey);

  @override
  Future<void> write(String token) => _storage.write(key: _storageKey, value: token);
}

final _valid = RegExp(r'^[A-Za-z0-9_-]{32,128}$');

/// Reads the saved token or creates and saves one. If the secure storage is unavailable the token
/// lives for this run only: the app keeps working, the trackers just are not remembered.
Future<String> loadOrCreateOwnerToken(TokenStorage storage, [Random? random]) async {
  try {
    final saved = await storage.read();
    if (saved != null && _valid.hasMatch(saved)) return saved;
  } catch (_) {
    return generateOwnerToken(random);
  }
  final fresh = generateOwnerToken(random);
  try {
    await storage.write(fresh);
  } catch (_) {}
  return fresh;
}

/// Overridden in `main` with the loaded token. Empty means "no token": requests go out without one.
final ownerTokenProvider = Provider<String>((ref) => '');

class OwnerTokenInterceptor extends Interceptor {
  OwnerTokenInterceptor(this.token);
  final String token;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    if (token.isNotEmpty) options.headers['authorization'] = 'Bearer $token';
    handler.next(options);
  }
}
