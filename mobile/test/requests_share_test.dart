import 'package:flutter_test/flutter_test.dart';
import 'package:remeeet/core/dates.dart';
import 'package:remeeet/core/requests.dart';
import 'package:remeeet/core/share.dart';

void main() {
  group('party rules (same as the API)', () {
    test('an infant needs an adult, nine seats at most', () {
      expect(const Party().copyWith(infants: 2).infants, 1);
      expect(const Party(adults: 3, infants: 2).copyWith(adults: 1).infants, 1);
      final big = const Party(adults: 5, children: 4).copyWith(infants: 1);
      expect(big.total, lessThanOrEqualTo(9));
      expect(const Party().copyWith(adults: 20).adults, 9);
      expect(const Party().copyWith(children: 99).children, 8);
    });
  });

  group('request bodies', () {
    test('search: return date and filters only when set', () {
      final one = searchRequest(from: 'WAW', to: 'BCN', range: const DateRange('2026-11-28', null), party: const Party());
      expect(one.containsKey('returnDate'), isFalse);
      expect(one.containsKey('filters'), isFalse);
      expect(one['adults'], 1);
      final both = searchRequest(from: 'WAW', to: 'BCN', range: const DateRange('2026-11-28', '2026-11-29'), party: const Party(adults: 2, children: 1), filters: idealFilters('2026-11-28'));
      expect(both['returnDate'], '2026-11-29');
      expect(both['children'], 1);
      expect((both['filters'] as Map)['outbound'], {'departAfter': '08:00'});
    });

    test('explore: direct only and budget become filters', () {
      final r = exploreRequest(from: 'WAW', range: const DateRange('2026-12-02', '2026-12-09'), party: const Party(), maxHours: 3, directOnly: true, budget: 200);
      expect(r['maxFlightHours'], 3);
      expect((r['filters'] as Map)['maxStops'], 0);
      expect((r['filters'] as Map)['maxPrice'], 200);
      final plain = exploreRequest(from: 'WAW', range: const DateRange('2026-12-02', '2026-12-09'), party: const Party(), maxHours: 4, directOnly: false);
      expect(plain.containsKey('filters'), isFalse);
    });

    test('meetup carries friends with several airports', () {
      final r = meetupRequest(
        friends: [(id: 'a', name: 'Ann', origins: ['KRK', 'KTW']), (id: 'b', name: 'Bo', origins: ['BER'])],
        destinations: ['FNC'],
        range: const DateRange('2026-11-28', '2026-11-29'),
        valuePerHour: 40,
      );
      expect((r['friends'] as List).first, {'id': 'a', 'name': 'Ann', 'origins': ['KRK', 'KTW']});
      expect(r['valuePerHour'], 40);
      expect(r.containsKey('maxBudgetPerPerson'), isFalse);
    });

    test('flex day keeps the direction', () {
      final r = flexDayRequest(from: 'BCN', to: 'WAW', date: '2026-11-29', direction: 'inbound', party: const Party());
      expect(r['direction'], 'inbound');
      expect(r['origin'], 'BCN');
    });
  });

  group('share links (format the web app reads)', () {
    Map<String, String> q(String url) => Uri.parse(url).queryParameters;

    test('search', () {
      final u = searchShareUrl(from: 'WAW', to: 'ACE', weekendMode: true, saturday: '2026-11-28', shape: WeekendShape.friSun, adults: 2, children: 1, infants: 1, cabin: 'business');
      expect(Uri.parse(u).path, '/');
      expect(q(u), {'from': 'WAW', 'to': 'ACE', 'sat': '2026-11-28', 'shape': 'fri-sun', 'a': '2', 'c': '1', 'i': '1', 'cabin': 'business'});
    });

    test('defaults are left out, custom dates use dep/ret', () {
      expect(q(searchShareUrl(from: 'WAW', to: 'BCN', weekendMode: true, saturday: '2026-11-28', shape: WeekendShape.satSun)), {'from': 'WAW', 'to': 'BCN', 'sat': '2026-11-28'});
      expect(q(searchShareUrl(from: 'WAW', to: 'BCN', weekendMode: false, depart: '2026-12-02', ret: '2026-12-06')), {'from': 'WAW', 'to': 'BCN', 'dep': '2026-12-02', 'ret': '2026-12-06'});
      expect(q(searchShareUrl(from: 'WAW', to: 'BCN', weekendMode: false, depart: '2026-12-02')).containsKey('ret'), isFalse);
    });

    test('explore', () {
      final u = exploreShareUrl(from: 'KRK', weekendMode: false, depart: '2026-12-02', ret: '2026-12-09', maxHours: 5, directOnly: true, budget: '250', adults: 2);
      expect(Uri.parse(u).path, '/explore');
      expect(q(u), {'from': 'KRK', 'dep': '2026-12-02', 'ret': '2026-12-09', 'h': '5', 'direct': '1', 'budget': '250', 'a': '2'});
      expect(q(exploreShareUrl(from: 'KRK', weekendMode: true, saturday: '2026-12-05', budget: 'abc')).containsKey('budget'), isFalse);
    });

    test('meetup: friends with several airports, names stay readable', () {
      final u = meetupShareUrl(
        friends: [(name: 'Світлана', origins: ['KRK', 'KTW']), (name: 'A~B,C', origins: ['BER']), (name: '', origins: ['LIS']), (name: 'NoAirport', origins: [''])],
        destinations: ['FNC', 'BCN'],
        weekendMode: false,
        depart: '2026-12-02',
        ret: '2026-12-06',
        valuePerHour: 40,
        budget: '300',
        includeOrigins: true,
      );
      expect(Uri.parse(u).path, '/meetup');
      final p = q(u);
      expect(p['f'], 'Світлана~KRK.KTW,A B C~BER'); // decoded back from the URL
      expect(p['to'], 'FNC,BCN');
      expect(p['own'], '1');
      expect(p['vph'], '40');
      expect(p['dep'], '2026-12-02');
    });
  });
}
