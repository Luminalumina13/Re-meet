import 'package:flutter_test/flutter_test.dart';
import 'package:remeeet/core/dates.dart';
import 'package:remeeet/core/flex.dart';
import 'package:remeeet/core/models.dart';

FlexOption opt(double price, String depart, String arrive) => FlexOption(price: price, departUtc: depart, arriveUtc: arrive, departLocal: depart, providerName: 't');

void main() {
  group('dates', () {
    test('addDays and weekday', () {
      expect(addDays('2026-11-28', 3), '2026-12-01');
      expect(addDays('2026-12-31', 1), '2027-01-01');
      expect(weekday('2026-11-28'), 6); // Saturday
      expect(weekday('2026-11-27'), 5); // Friday
      expect(weekday('2026-11-29'), 0); // Sunday
    });

    test('nextSaturday is strictly after the given day', () {
      expect(nextSaturday('2026-11-15'), '2026-11-21');
      expect(nextSaturday('2026-11-21'), '2026-11-28');
      expect(nextSaturday('2026-11-22'), '2026-11-28');
    });

    test('weekend shapes', () {
      expect(weekendFrom('2026-11-28', WeekendShape.satSun).depart, '2026-11-28');
      expect(weekendFrom('2026-11-28', WeekendShape.satSun).ret, '2026-11-29');
      expect(weekendFrom('2026-11-28', WeekendShape.friMon).depart, '2026-11-27');
      expect(weekendFrom('2026-11-28', WeekendShape.friMon).ret, '2026-11-30');
      expect(weekendFrom('2026-11-28', WeekendShape.thuSun).depart, '2026-11-26');
    });

    test('upcoming Saturdays', () {
      final l = upcomingSaturdays('2026-11-15', count: 3);
      expect(l, ['2026-11-21', '2026-11-28', '2026-12-05']);
    });

    test('the default time window starts at noon on Fridays only', () {
      expect(idealFilters('2026-11-27').departAfter, '12:00'); // Friday
      expect(idealFilters('2026-11-28').departAfter, '08:00'); // Saturday
      expect(idealFilters('2026-11-26').departAfter, '08:00'); // Thursday
      expect(idealFilters('2026-11-27').arriveAfter, '17:00');
      expect(idealFilters('2026-11-27').toJson(), {
        'outbound': {'departAfter': '12:00'},
        'inbound': {'arriveAfter': '17:00', 'arriveBefore': '23:30'},
      });
    });
  });

  group('flexible dates', () {
    test('lists the days around a date and drops the past', () {
      expect(flexDates('2026-11-28', 3), ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
      expect(flexDates('2026-11-28', 3, notBefore: '2026-11-27'), ['2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']);
    });

    test('pairs only flights that fit together and takes the cheapest combination', () {
      final out = {
        '2026-11-21': [opt(94, '2026-11-21T18:20:00Z', '2026-11-22T14:35:00Z'), opt(150, '2026-11-21T18:20:00Z', '2026-11-22T07:50:00Z')],
      };
      final back = {
        '2026-11-22': [opt(184, '2026-11-22T11:10:00Z', '2026-11-22T21:30:00Z')],
        '2026-11-23': [opt(120, '2026-11-23T11:10:00Z', '2026-11-23T21:30:00Z')],
      };
      final cells = flexGrid(out, back, minStay: 120);
      // the 94 € flight lands after the 11:10 return has left, so only the 150 € one works
      expect(cells.firstWhere((c) => c.ret == '2026-11-22').price, 334);
      expect(cells.firstWhere((c) => c.ret == '2026-11-23').price, 214);
    });

    test('drops returns before the departure and too short stays', () {
      final out = {'2026-11-23': [opt(50, '2026-11-23T06:00:00Z', '2026-11-23T08:00:00Z')]};
      final back = {
        '2026-11-22': [opt(40, '2026-11-22T20:00:00Z', '2026-11-22T22:00:00Z')],
        '2026-11-23': [opt(40, '2026-11-23T09:00:00Z', '2026-11-23T11:00:00Z')],
      };
      expect(flexGrid(out, back), isEmpty);
      final loose = flexGrid(out, back, minStay: 30);
      expect(loose, hasLength(1));
      expect(loose.single.price, 90);
    });

    test('skips days with no fare', () {
      final out = {'2026-11-21': <FlexOption>[], '2026-11-22': [opt(40, '2026-11-22T06:00:00Z', '2026-11-22T08:00:00Z')]};
      final back = {'2026-11-24': [opt(30, '2026-11-24T20:00:00Z', '2026-11-24T22:00:00Z')]};
      final cells = flexGrid(out, back);
      expect(cells, hasLength(1));
      expect(cells.single.depart, '2026-11-22');
      expect(cells.single.price, 70);
    });

    test('ranks prices between 0 and 1', () {
      expect(priceRank(10, 10, 30), 0);
      expect(priceRank(30, 10, 30), 1);
      expect(priceRank(5, 5, 5), 0);
    });
  });
}
