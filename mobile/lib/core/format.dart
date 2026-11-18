import 'package:intl/intl.dart';

import 'dates.dart';
import 'strings.dart';

String money(num amount, String currency, Strings s) => NumberFormat.simpleCurrency(locale: s.locale == 'uk' ? 'uk_UA' : 'en_GB', name: currency, decimalDigits: 0).format(amount);

/// 190 → "3 год 10 хв".
String duration(int minutes, Strings s) {
  final h = minutes ~/ 60;
  final m = minutes % 60;
  if (h == 0) return '$m ${s('min')}';
  if (m == 0) return '$h ${s('h')}';
  return '$h ${s('h')} $m ${s('min')}';
}

/// "2026-11-28T15:30" → "15:30".
String clock(String local) => local.length >= 16 ? local.substring(11, 16) : local;

/// "2026-11-28" or "2026-11-28T15:30" → "28 лист.".
String shortDate(String isoOrLocal, Strings s) => DateFormat('d MMM', s.locale).format(parseIso(isoOrLocal.substring(0, 10)));

/// "2026-11-28" → "сб, 28.11".
String gridDate(String iso, Strings s) => '${DateFormat('E', s.locale).format(parseIso(iso))}, ${DateFormat('d.MM').format(parseIso(iso))}';

String dateRange(String depart, String? ret, Strings s) => ret == null || ret == depart ? shortDate(depart, s) : '${shortDate(depart, s)} – ${shortDate(ret, s)}';
