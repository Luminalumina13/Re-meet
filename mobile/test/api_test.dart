import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:remeeet/core/api.dart';
import 'package:remeeet/core/dates.dart';
import 'package:remeeet/core/requests.dart';
import 'package:remeeet/core/strings.dart';
import 'package:remeeet/ui/common.dart';

import 'helpers.dart';

class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.handler);
  final ResponseBody Function(RequestOptions) handler;
  final List<RequestOptions> seen = [];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    seen.add(options);
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody json(Object? data, [int status = 200]) => ResponseBody.fromString(jsonEncode(data), status, headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    });

RemeetApi apiWith(FakeAdapter a) => RemeetApi(Dio(BaseOptions(baseUrl: 'http://test'))..httpClientAdapter = a);

void main() {
  test('watches lists the caller’s trackers', () async {
    final a = FakeAdapter((o) => json([fixture('watch.json')]));
    final list = await apiWith(a).watches();
    expect(list, hasLength(1));
    expect(a.seen.single.path, '/api/watches');
    expect(a.seen.single.method, 'GET');
  });

  test('search posts the request body and parses the answer', () async {
    final a = FakeAdapter((o) => json(fixture('search.json')));
    final r = await apiWith(a).search(searchRequest(from: 'WAW', to: 'BCN', range: const DateRange('2026-11-28', '2026-11-29'), party: const Party(adults: 2)));
    expect(r.itineraries, hasLength(3));
    expect(a.seen.single.method, 'POST');
    expect(a.seen.single.path, '/api/search');
    final body = a.seen.single.data as Map;
    expect(body['origin'], 'WAW');
    expect(body['adults'], 2);
  });

  test('airports use the q parameter', () async {
    final a = FakeAdapter((o) => json(fixtureList('airports.json')));
    final list = await apiWith(a).airports('funch');
    expect(list.single.iata, 'FNC');
    expect(a.seen.single.queryParameters, {'q': 'funch'});
  });

  test('flex day, meetup and explore hit their endpoints', () async {
    final a = FakeAdapter((o) {
      if (o.path == '/api/flex') return json(fixture('flex.json'));
      if (o.path == '/api/meetup') return json(fixture('meetup.json'));
      return json(fixture('explore.json'));
    });
    final api = apiWith(a);
    expect((await api.flexDay(flexDayRequest(from: 'WAW', to: 'BCN', date: '2026-11-28', direction: 'outbound', party: const Party()))).options, isNotEmpty);
    expect((await api.meetup({})).plans, isNotEmpty);
    expect((await api.explore({})).destinations, isNotEmpty);
    expect(a.seen.map((o) => o.path), ['/api/flex', '/api/meetup', '/api/explore']);
  });

  test('watch calls: create, patch, delete, check, telegram link', () async {
    final a = FakeAdapter((o) {
      if (o.method == 'DELETE') return ResponseBody.fromString('', 204);
      if (o.path.endsWith('/telegram')) return json({'url': 'https://t.me/Bot?start=abc', 'expiresAt': 'x'});
      if (o.path.endsWith('/check')) return json({'watch': fixture('watch.json'), 'alerts': <dynamic>[]});
      return json(fixture('watch.json'));
    });
    final api = apiWith(a);
    final w = await api.createWatch({'label': 'x'});
    expect(w.label, 'fixture');
    expect((await api.patchWatch('id', {'active': false})).id, w.id);
    expect((await api.checkWatch('id')).id, w.id);
    expect((await api.telegramLink('id')).toString(), 'https://t.me/Bot?start=abc');
    await api.deleteWatch('id');
    expect(a.seen.map((o) => '${o.method} ${o.path}'), ['POST /api/watches', 'PATCH /api/watches/id', 'POST /api/watches/id/check', 'POST /api/watches/id/telegram', 'DELETE /api/watches/id']);
    expect((a.seen[1].data as Map)['active'], false);
  });

  test('a deleted watch is null, not an error', () async {
    final api = apiWith(FakeAdapter((o) => json({'error': 'Not found'}, 404)));
    expect(await api.getWatch('gone'), isNull);
  });

  group('errors become readable messages', () {
    test('validation issues keep the code and the server messages', () async {
      final api = apiWith(FakeAdapter((o) => json({'error': 'invalid_request', 'code': 'invalid_request', 'issues': [{'path': ['infants'], 'message': 'Each infant needs an adult'}]}, 400)));
      await expectLater(
        api.search({}),
        throwsA(isA<ApiException>().having((e) => e.message, 'message', 'invalid_request').having((e) => e.issues, 'issues', ['Each infant needs an adult'])),
      );
    });

    test('a server error code is kept, never shown raw', () async {
      final api = apiWith(FakeAdapter((o) => json({'error': 'unavailable', 'code': 'unavailable'}, 503)));
      await expectLater(api.telegramLink('x'), throwsA(isA<ApiException>().having((e) => e.code, 'code', 'unavailable').having((e) => e.status, 'status', 503)));
    });

    test('codes map to localized texts', () {
      final s = const Strings('en');
      expect(errorText(ApiException('invalid_request', issues: ['Each infant needs an adult']), s), s('errInfants'));
      expect(errorText(ApiException('invalid_request', issues: ['Required']), s), s('errInvalid'));
      expect(errorText(ApiException('not_found', code: 'not_found'), s), s('errNotFound'));
      expect(errorText(ApiException('internal', code: 'internal'), s), s('errServer'));
    });

    test('network failures map to offline / timeout', () async {
      final offline = apiWith(FakeAdapter((o) => throw DioException(requestOptions: o, type: DioExceptionType.connectionError)));
      await expectLater(offline.search({}), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'offline')));
      final slow = apiWith(FakeAdapter((o) => throw DioException(requestOptions: o, type: DioExceptionType.receiveTimeout)));
      await expectLater(slow.search({}), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'timeout')));
    });

    test('a bare 500 is a generic server error', () async {
      final api = apiWith(FakeAdapter((o) => ResponseBody.fromString('oops', 500)));
      await expectLater(api.search({}), throwsA(isA<ApiException>().having((e) => e.message, 'message', 'server')));
    });
  });
}
