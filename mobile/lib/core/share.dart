import 'config.dart';
import 'dates.dart';

/// Links to the website that re-create a search, in the format the web app reads (see `src/lib/share.ts`).
/// Sharing from the app and opening the link on the web (or the other way round) gives the same form.
String _url(String path, Map<String, String> q) => Uri.parse(webBaseUrl).replace(path: path, queryParameters: q.isEmpty ? null : q).toString();

void _party(Map<String, String> q, int adults, int children, int infants) {
  if (adults != 1) q['a'] = '$adults';
  if (children > 0) q['c'] = '$children';
  if (infants > 0) q['i'] = '$infants';
}

void _dates(Map<String, String> q, {required bool weekendMode, String? saturday, WeekendShape? shape, String? depart, String? ret}) {
  if (weekendMode) {
    if (saturday != null) q['sat'] = saturday;
    if (shape != null && shape != WeekendShape.satSun) q['shape'] = shape.code;
  } else {
    if (depart != null) q['dep'] = depart;
    if (ret != null) q['ret'] = ret;
  }
}

String searchShareUrl({required String from, required String to, required bool weekendMode, String? saturday, WeekendShape? shape, String? depart, String? ret, int adults = 1, int children = 0, int infants = 0, String cabin = 'economy'}) {
  final q = <String, String>{'from': from, 'to': to};
  _dates(q, weekendMode: weekendMode, saturday: saturday, shape: shape, depart: depart, ret: ret);
  _party(q, adults, children, infants);
  if (cabin != 'economy') q['cabin'] = cabin;
  return _url('/', q);
}

String exploreShareUrl({required String from, required bool weekendMode, String? saturday, WeekendShape? shape, String? depart, String? ret, int maxHours = 4, bool directOnly = false, String budget = '', int adults = 1, int children = 0, int infants = 0}) {
  final q = <String, String>{'from': from};
  _dates(q, weekendMode: weekendMode, saturday: saturday, shape: shape, depart: depart, ret: ret);
  if (maxHours != 4) q['h'] = '$maxHours';
  if (directOnly) q['direct'] = '1';
  if (RegExp(r'^\d+$').hasMatch(budget)) q['budget'] = budget;
  _party(q, adults, children, infants);
  return _url('/explore', q);
}

/// Friends travel as `Name~WAW.KRK`, comma separated; names cannot contain `~` or `,`.
String meetupShareUrl({required List<({String name, List<String> origins})> friends, required List<String> destinations, required bool weekendMode, String? saturday, WeekendShape? shape, String? depart, String? ret, int valuePerHour = 15, String budget = '', bool includeOrigins = false}) {
  final q = <String, String>{};
  final f = friends.where((x) => x.name.trim().isNotEmpty && x.origins.any((o) => o.isNotEmpty)).map((x) => '${x.name.trim().replaceAll(RegExp('[~,]'), ' ')}~${x.origins.where((o) => o.isNotEmpty).join('.')}').join(',');
  if (f.isNotEmpty) q['f'] = f;
  final to = destinations.where((d) => d.isNotEmpty).join(',');
  if (to.isNotEmpty) q['to'] = to;
  if (includeOrigins) q['own'] = '1';
  _dates(q, weekendMode: weekendMode, saturday: saturday, shape: shape, depart: depart, ret: ret);
  if (valuePerHour != 15) q['vph'] = '$valuePerHour';
  if (RegExp(r'^\d+$').hasMatch(budget)) q['budget'] = budget;
  return _url('/meetup', q);
}
