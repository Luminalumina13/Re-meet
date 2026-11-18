import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config.dart';
import 'owner_token.dart';
import 'models.dart';

/// A readable failure from the backend or the network.
class ApiException implements Exception {
  ApiException(this.message, {this.status, this.code, this.issues = const []});

  /// Client-side kinds ('offline', 'timeout', 'server') or the server's stable `code`.
  final String message;
  final int? status;
  final String? code;

  /// Validation messages reported by the server (stable English texts).
  final List<String> issues;
  @override
  String toString() => message;
}

class RemeetApi {
  RemeetApi(this._dio);
  final Dio _dio;

  Future<T> _call<T>(Future<Response<dynamic>> Function() request, T Function(dynamic) parse) async {
    try {
      final res = await request();
      return parse(res.data);
    } on DioException catch (e) {
      throw _map(e);
    }
  }

  ApiException _map(DioException e) {
    final data = e.response?.data;
    if (data is Map) {
      final code = data['code'];
      final issues = data['issues'];
      final messages = issues is List ? [for (final i in issues) if (i is Map && i['message'] is String) i['message'] as String] : <String>[];
      if (code is String) return ApiException(code, status: e.response?.statusCode, code: code, issues: messages);
    }
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException('timeout');
      case DioExceptionType.connectionError:
        return ApiException('offline');
      default:
        return ApiException('server', status: e.response?.statusCode);
    }
  }

  Future<List<Airport>> airports(String q, {CancelToken? cancel}) => _call(
        () => _dio.get('/api/airports', queryParameters: {'q': q}, cancelToken: cancel),
        (d) => (d as List).map((e) => Airport.fromJson(e as Json)).toList(),
      );

  Future<SearchResult> search(Json request, {CancelToken? cancel}) => _call(() => _dio.post('/api/search', data: request, cancelToken: cancel), (d) => SearchResult.fromJson(d as Json));

  Future<ExploreResult> explore(Json request, {CancelToken? cancel}) => _call(() => _dio.post('/api/explore', data: request, cancelToken: cancel), (d) => ExploreResult.fromJson(d as Json));

  Future<MeetupResult> meetup(Json request, {CancelToken? cancel}) => _call(() => _dio.post('/api/meetup', data: request, cancelToken: cancel), (d) => MeetupResult.fromJson(d as Json));

  Future<FlexDay> flexDay(Json request, {CancelToken? cancel}) => _call(() => _dio.post('/api/flex', data: request, cancelToken: cancel), (d) => FlexDay.fromJson(d as Json));

  Future<Watch> createWatch(Json body) => _call(() => _dio.post('/api/watches', data: body), (d) => Watch.fromJson(d as Json));

  /// The caller's own trackers (the server filters by the owner token).
  Future<List<Watch>> watches() => _call(() => _dio.get('/api/watches'), (d) => (d as List).map((e) => Watch.fromJson(e as Json)).toList());

  Future<Watch?> getWatch(String id) async {
    try {
      final res = await _dio.get('/api/watches/$id');
      return Watch.fromJson(res.data as Json);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null; // deleted elsewhere
      throw _map(e);
    }
  }

  Future<Watch> patchWatch(String id, Json patch) => _call(() => _dio.patch('/api/watches/$id', data: patch), (d) => Watch.fromJson(d as Json));

  Future<void> deleteWatch(String id) => _call(() => _dio.delete('/api/watches/$id'), (_) {});

  Future<Watch> checkWatch(String id) => _call(() => _dio.post('/api/watches/$id/check'), (d) => Watch.fromJson((d as Json)['watch'] as Json));

  /// One-time t.me link that connects this tracker to the user's Telegram chat.
  Future<Uri> telegramLink(String id) => _call(() => _dio.post('/api/watches/$id/telegram'), (d) => Uri.parse((d as Json)['url'] as String));
}

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: apiBaseUrl,
    connectTimeout: const Duration(seconds: 15),
    // A search asks several airlines and can take up to a minute.
    receiveTimeout: const Duration(seconds: 180),
    headers: {'accept': 'application/json'},
    contentType: Headers.jsonContentType,
  ));
  dio.interceptors.add(OwnerTokenInterceptor(ref.watch(ownerTokenProvider)));
  return dio;
});

final apiProvider = Provider<RemeetApi>((ref) => RemeetApi(ref.watch(dioProvider)));
