import 'package:flutter_test/flutter_test.dart';
import 'package:remeeet/core/models.dart';

import 'helpers.dart';

/// These parse responses captured from the real backend, so a change in the API shape shows up here.
void main() {
  test('search response', () {
    final r = SearchResult.fromJson(fixture('search.json'));
    expect(r.itineraries, hasLength(3));
    final it = r.itineraries.first;
    expect(it.legs, hasLength(2));
    expect(it.price.amount, greaterThan(0));
    expect(it.price.currency, 'EUR');
    expect(it.legs.first.from.length, 3);
    expect(it.legs.first.segments, isNotEmpty);
    expect(it.legs.first.airlines, isNotEmpty);
    expect(it.totalMinutes, it.legs.fold<int>(0, (s, l) => s + l.durationMin));
    expect(r.providers, isNotEmpty);
    expect(r.providers.every((p) => p.id.isNotEmpty && p.status.isNotEmpty), isTrue);
  });

  test('explore response', () {
    final r = ExploreResult.fromJson(fixture('explore.json'));
    expect(r.destinations, hasLength(2));
    final d = r.destinations.first;
    expect(d.city, isNotEmpty);
    expect(d.airports, isNotEmpty);
    expect(d.best.legs, isNotEmpty);
    expect(d.cheapest.price.amount, lessThanOrEqualTo(d.best.price.amount + 0.001));
    expect(d.minutesThere, greaterThan(0));
  });

  test('meetup response', () {
    final r = MeetupResult.fromJson(fixture('meetup.json'));
    expect(r.plans, isNotEmpty);
    final p = r.plans.first;
    expect(p.destination, 'FNC');
    expect(p.friends, hasLength(2));
    expect(p.friends.every((f) => !f.isHost && f.outbound != null && f.inbound != null), isTrue);
    expect(p.friends.first.friend.origins, isNotEmpty);
    expect(p.togetherMinutes, greaterThan(0));
    // The planner's own invariant: time together = earliest leave − latest arrival.
    final start = p.friends.map((f) => DateTime.parse(f.arriveUtc!)).reduce((a, b) => a.isAfter(b) ? a : b);
    final end = p.friends.map((f) => DateTime.parse(f.departUtc!)).reduce((a, b) => a.isBefore(b) ? a : b);
    expect(end.difference(start).inMinutes, p.togetherMinutes);
  });

  test('flex day response', () {
    final d = FlexDay.fromJson(fixture('flex.json'));
    expect(d.options, isNotEmpty);
    expect(d.options.first.price, greaterThan(0));
    // cheapest first
    for (var i = 1; i < d.options.length; i++) {
      expect(d.options[i].price, greaterThanOrEqualTo(d.options[i - 1].price));
    }
  });

  test('watch response', () {
    final w = Watch.fromJson(fixture('watch.json'));
    expect(w.kind, 'search');
    expect(w.label, 'fixture');
    expect(w.targetPrice, 100);
    expect(w.active, isTrue);
    expect(w.history, isNotEmpty);
    expect(w.telegramConnected, isFalse);
  });

  test('airports', () {
    final list = fixtureList('airports.json').map((e) => Airport.fromJson(e as Json)).toList();
    expect(list.first.iata, 'FNC');
    expect(list.first.label, 'Funchal (FNC)');
  });

  test('missing optional fields do not crash', () {
    final it = Itinerary.fromJson({
      'id': 'x',
      'provider': 'p',
      'providerName': 'P',
      'legs': <dynamic>[],
      'price': {'amount': 10, 'currency': 'EUR'},
    });
    expect(it.deepLink, isNull);
    expect(it.otherOffers, isEmpty);
    expect(it.comfort, 0);
    expect(it.isDirect, isTrue);
    final w = Watch.fromJson({'id': 'w', 'label': 'l', 'currency': 'EUR', 'params': {'kind': 'meetup'}});
    expect(w.history, isEmpty);
    expect(w.lastDelta, 0);
  });

  test('price delta uses the last two checks', () {
    final w = Watch.fromJson({
      'id': 'w',
      'label': 'l',
      'currency': 'EUR',
      'params': {'kind': 'search'},
      'history': [
        {'at': 'a', 'bestPrice': 120},
        {'at': 'b', 'bestPrice': 100},
      ],
    });
    expect(w.lastDelta, -20);
  });
}
