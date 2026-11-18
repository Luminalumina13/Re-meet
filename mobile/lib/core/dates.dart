/// Date helpers on ISO `YYYY-MM-DD` strings. Dates are calendar days without a time zone, so
/// everything is computed in UTC to stay clear of daylight-saving surprises.
DateTime parseIso(String iso) {
  final p = iso.split('-').map(int.parse).toList();
  return DateTime.utc(p[0], p[1], p[2]);
}

String toIso(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String todayIso([DateTime? now]) {
  final n = now ?? DateTime.now();
  return toIso(DateTime.utc(n.year, n.month, n.day));
}

String addDays(String iso, int days) => toIso(parseIso(iso).add(Duration(days: days)));

/// 0 = Sunday … 6 = Saturday, like the web app.
int weekday(String iso) => parseIso(iso).weekday % 7;

/// The first Saturday strictly after [from].
String nextSaturday(String from) {
  final wd = weekday(from);
  final delta = (6 - wd + 7) % 7;
  return addDays(from, delta == 0 ? 7 : delta);
}

enum WeekendShape {
  satSun('sat-sun', 0, 1),
  friSun('fri-sun', -1, 1),
  satMon('sat-mon', 0, 2),
  friMon('fri-mon', -1, 2),
  thuSun('thu-sun', -2, 1);

  const WeekendShape(this.code, this.out, this.back);
  final String code;
  final int out;
  final int back;

  static WeekendShape? fromCode(String? c) {
    for (final s in values) {
      if (s.code == c) return s;
    }
    return null;
  }
}

class DateRange {
  const DateRange(this.depart, this.ret);
  final String depart;
  final String? ret;
}

DateRange weekendFrom(String saturday, WeekendShape shape) => DateRange(addDays(saturday, shape.out), addDays(saturday, shape.back));

List<String> upcomingSaturdays(String today, {int count = 10}) {
  final out = <String>[];
  var s = nextSaturday(today);
  for (var i = 0; i < count; i++) {
    out.add(s);
    s = addDays(s, 7);
  }
  return out;
}

/// Default time-of-day windows: leave after breakfast (after noon on Fridays, when people are
/// at work) and come back in the evening.
class TimeFilters {
  const TimeFilters({this.departAfter, this.departBefore, this.arriveAfter, this.arriveBefore});
  final String? departAfter;
  final String? departBefore;
  final String? arriveAfter;
  final String? arriveBefore;

  bool get isEmpty => departAfter == null && departBefore == null && arriveAfter == null && arriveBefore == null;

  /// The JSON the API expects for `filters`.
  Map<String, dynamic> toJson() => {
        if (departAfter != null || departBefore != null) 'outbound': {if (departAfter != null) 'departAfter': departAfter, if (departBefore != null) 'departBefore': departBefore},
        if (arriveAfter != null || arriveBefore != null) 'inbound': {if (arriveAfter != null) 'arriveAfter': arriveAfter, if (arriveBefore != null) 'arriveBefore': arriveBefore},
      };
}

const fridayDepartAfter = '12:00';

TimeFilters idealFilters(String departDate) => TimeFilters(
      departAfter: weekday(departDate) == 5 ? fridayDepartAfter : '08:00',
      arriveAfter: '17:00',
      arriveBefore: '23:30',
    );
