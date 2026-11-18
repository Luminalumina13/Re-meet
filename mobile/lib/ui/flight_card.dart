import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/theme.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/strings.dart';
import 'common.dart';
import 'links.dart';

/// One leg: times and airports on both ends, duration, stops and airlines in the middle.
class LegRow extends ConsumerWidget {
  const LegRow({super.key, required this.leg, this.compact = false});
  final Leg leg;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final nextDay = leg.arriveLocal.length >= 10 && leg.departLocal.length >= 10 && leg.arriveLocal.substring(0, 10) != leg.departLocal.substring(0, 10);
    final big = TextStyle(fontSize: compact ? 17 : 21, fontWeight: FontWeight.w800, height: 1.1);
    Widget end(String time, String code, String date, {bool plusDay = false}) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(time, style: big),
            if (plusDay) Padding(padding: const EdgeInsets.only(left: 2), child: Text('+1', style: TextStyle(color: rc.warn, fontSize: 11, fontWeight: FontWeight.w800))),
          ]),
          const SizedBox(height: 2),
          Text('$code · ${shortDate(date, s)}', style: TextStyle(fontSize: 12, color: rc.text3, fontWeight: FontWeight.w600)),
        ]);
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      end(clock(leg.departLocal), leg.from, leg.departLocal),
      Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Column(children: [
            Text(duration(leg.durationMin, s), style: TextStyle(fontSize: 11.5, color: rc.text2, fontWeight: FontWeight.w700)),
            const SizedBox(height: 3),
            Row(children: [
              Expanded(child: Divider(color: rc.borderStrong, thickness: 1.2)),
              if (leg.stops > 0) Container(width: 7, height: 7, margin: const EdgeInsets.symmetric(horizontal: 3), decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: rc.warn, width: 1.6))),
              if (leg.stops > 0) Expanded(child: Divider(color: rc.borderStrong, thickness: 1.2)),
            ]),
            Text(leg.stops == 0 ? s('direct') : s('stops', {'n': leg.stops}), style: TextStyle(fontSize: 11.5, color: leg.stops == 0 ? rc.good : rc.warn, fontWeight: FontWeight.w800)),
            if (leg.airlines.isNotEmpty) Text(leg.airlines, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: rc.text3)),
          ]),
        ),
      ),
      end(clock(leg.arriveLocal), leg.to, leg.arriveLocal, plusDay: nextDay),
    ]);
  }
}

/// A search result: all legs, badges, price, other sources, and the buttons to track or open it.
class FlightCard extends ConsumerWidget {
  const FlightCard({super.key, required this.it, this.onTrack, this.perPersonDivisor = 1, this.highlight = false});
  final Itinerary it;
  final VoidCallback? onTrack;

  /// Adults + children; the price is shown per person when this is above one.
  final int perPersonDivisor;
  final bool highlight;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    return Panel(
      highlight: highlight,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (var i = 0; i < it.legs.length; i++) ...[
          if (i > 0) Padding(padding: const EdgeInsets.symmetric(vertical: 12), child: Divider(color: rc.border)),
          LegRow(leg: it.legs[i]),
        ],
        const SizedBox(height: 14),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: Wrap(spacing: 6, runSpacing: 6, children: [
              if (it.comfort > 0) Pill(s('comfort', {'n': it.comfort}), color: it.comfort >= 80 ? rc.good : rc.accentText, background: it.comfort >= 80 ? rc.good.withValues(alpha: 0.14) : rc.soft),
              if (it.isDirect) Pill(s('direct'), color: rc.good, background: rc.good.withValues(alpha: 0.14)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(money(it.price.amount, it.price.currency, s), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
            if (perPersonDivisor > 1) Text('${money(it.price.amount / perPersonDivisor, it.price.currency, s)} ${s('perPerson')}', style: TextStyle(fontSize: 11.5, color: rc.text3)),
            Text(it.providerName, style: TextStyle(fontSize: 12, color: rc.text3)),
          ]),
        ]),
        if (it.otherOffers.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(spacing: 12, runSpacing: 4, children: [
            Text('${s('alsoOn')}:', style: TextStyle(fontSize: 12, color: rc.text3)),
            for (final o in it.otherOffers) InkWell(onTap: () => openLink(context, o.deepLink), child: Text('${o.providerName} ${money(o.price.amount, o.price.currency, s)}', style: TextStyle(fontSize: 12, color: rc.text2, fontWeight: FontWeight.w700, decoration: TextDecoration.underline))),
          ]),
        ],
        const SizedBox(height: 12),
        Row(children: [
          if (onTrack != null)
            Expanded(
              // The label shrinks a little instead of wrapping onto two lines in a half-width button.
              child: OutlinedButton(
                onPressed: onTrack,
                child: FittedBox(fit: BoxFit.scaleDown, child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.notifications_none, size: 18), const SizedBox(width: 6), Text(s('track'), maxLines: 1)])),
              ),
            ),
          if (onTrack != null) const SizedBox(width: 10),
          Expanded(child: FilledButton.icon(onPressed: it.deepLink == null ? null : () => openLink(context, it.deepLink), icon: const Icon(Icons.open_in_new, size: 18), label: Text(s('open')))),
        ]),
      ]),
    );
  }
}
