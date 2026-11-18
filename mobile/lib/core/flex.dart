import 'dates.dart';
import 'models.dart';

/// [days] dates either side of [center], oldest first, without dates before [notBefore].
List<String> flexDates(String center, int days, {String? notBefore}) {
  final out = <String>[];
  for (var i = -days; i <= days; i++) {
    final d = addDays(center, i);
    if (notBefore == null || d.compareTo(notBefore) >= 0) out.add(d);
  }
  return out;
}

class FlexCell {
  const FlexCell(this.depart, this.ret, this.price);
  final String depart;
  final String ret;
  final int price;
}

/// Buffer between landing and the return take-off for a pair to count as a trip.
const minStayMinutes = 3 * 60;

/// Round-trip grid from one-way fares. A pair counts only if the return flight leaves at least
/// [minStay] minutes after the outbound lands; the cheapest such combination wins. Prices are sums
/// of two one-way tickets, so they are estimates.
List<FlexCell> flexGrid(Map<String, List<FlexOption>> out, Map<String, List<FlexOption>> back, {int minStay = minStayMinutes}) {
  final cells = <FlexCell>[];
  for (final o in out.entries) {
    for (final b in back.entries) {
      if (b.key.compareTo(o.key) < 0) continue;
      double? best;
      for (final x in o.value) {
        for (final y in b.value) {
          final gap = DateTime.parse(y.departUtc).difference(DateTime.parse(x.arriveUtc)).inMinutes;
          if (gap < minStay) continue;
          final sum = x.price + y.price;
          if (best == null || sum < best) best = sum;
        }
      }
      if (best != null) cells.add(FlexCell(o.key, b.key, best.round()));
    }
  }
  return cells;
}

/// 0 for the cheapest price in the grid, 1 for the dearest; used to shade cells.
double priceRank(num price, num min, num max) => max > min ? (price - min) / (max - min) : 0;
