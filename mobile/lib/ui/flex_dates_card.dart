import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/theme.dart';
import '../core/api.dart';
import '../core/dates.dart';
import '../core/flex.dart';
import '../core/format.dart';
import '../core/models.dart';
import '../core/requests.dart';
import '../core/strings.dart';
import 'common.dart';

class FlexParams {
  const FlexParams({required this.from, required this.to, required this.depart, this.ret, required this.party, this.filters});
  final String from;
  final String to;
  final String depart;
  final String? ret;
  final Party party;
  final TimeFilters? filters;

  /// Everything that changes the answers; a different key means a grid on screen is stale.
  String get key => '$from|$to|$depart|$ret|${party.adults}|${party.children}|${party.infants}|${party.cabin}|${filters?.toJson()}';
}

/// Flexible dates: the cheapest fares for ±3 days around the chosen dates. One request per day and
/// direction, filled in as the answers arrive. Round-trip cells are sums of one-way fares.
class FlexDatesCard extends ConsumerStatefulWidget {
  const FlexDatesCard({super.key, required this.params, required this.onPick});
  final FlexParams params;
  final void Function(String depart, String? ret) onPick;

  @override
  ConsumerState<FlexDatesCard> createState() => _FlexDatesCardState();
}

class _FlexDatesCardState extends ConsumerState<FlexDatesCard> {
  static const _days = 3;
  static const _concurrency = 4;

  String? _startedKey;
  final Map<String, FlexDay?> _entries = {}; // null = this day failed
  CancelToken? _cancel;

  FlexParams get _p => widget.params;
  List<String> get _departDays => flexDates(_p.depart, _days, notBefore: todayIso());
  List<String> get _returnDays => _p.ret == null ? const [] : flexDates(_p.ret!, _days, notBefore: todayIso());

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    _cancel?.cancel();
    final cancel = CancelToken();
    _cancel = cancel;
    final key = _p.key;
    setState(() {
      _startedKey = key;
      _entries.clear();
    });
    final jobs = [for (final d in _departDays) ('out', d), for (final d in _returnDays) ('in', d)];
    var next = 0;
    Future<void> worker() async {
      while (next < jobs.length && !cancel.isCancelled) {
        final (dir, d) = jobs[next++];
        final from = dir == 'out' ? _p.from : _p.to;
        final to = dir == 'out' ? _p.to : _p.from;
        FlexDay? day;
        try {
          day = await ref.read(apiProvider).flexDay(flexDayRequest(from: from, to: to, date: d, direction: dir == 'out' ? 'outbound' : 'inbound', party: _p.party, filters: _p.filters), cancel: cancel);
        } catch (_) {
          day = null;
        }
        if (mounted && !cancel.isCancelled) setState(() => _entries['$dir:$d'] = day);
      }
    }

    await Future.wait([for (var i = 0; i < _concurrency; i++) worker()]);
  }

  bool get _fresh => _startedKey == _p.key;
  bool _loaded(String dir, String d) => _fresh && _entries.containsKey('$dir:$d');
  bool get _pending => _fresh && [for (final d in _departDays) 'out:$d', for (final d in _returnDays) 'in:$d'].any((k) => !_entries.containsKey(k));

  List<FlexOption> _options(String dir, String d) => _fresh ? (_entries['$dir:$d']?.options ?? const []) : const [];

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final roundTrip = _p.ret != null;
    final departDays = _departDays;
    final returnDays = _returnDays;

    final List<FlexCell> cells;
    if (roundTrip) {
      cells = flexGrid({for (final d in departDays) d: _options('out', d)}, {for (final d in returnDays) d: _options('in', d)});
    } else {
      cells = [
        for (final d in departDays)
          if (_options('out', d).isNotEmpty) FlexCell(d, d, _options('out', d).map((o) => o.price).reduce((a, b) => a < b ? a : b).round()),
      ];
    }
    final minPrice = cells.isEmpty ? 0 : cells.map((c) => c.price).reduce((a, b) => a < b ? a : b);
    final maxPrice = cells.isEmpty ? 0 : cells.map((c) => c.price).reduce((a, b) => a > b ? a : b);
    final best = cells.isEmpty ? null : cells.firstWhere((c) => c.price == minPrice);

    Widget cell(FlexCell? c, {required bool loading, required bool current, required String depart, String? ret}) {
      const w = 82.0;
      if (c == null) {
        return Container(width: w, height: 42, margin: const EdgeInsets.all(2), decoration: BoxDecoration(color: rc.surface2, borderRadius: BorderRadius.circular(10)), alignment: Alignment.center, child: Text(loading ? '…' : '—', style: TextStyle(color: rc.text3)));
      }
      final shade = (1 - priceRank(c.price, minPrice, maxPrice)) * 0.38;
      final isBest = c.price == minPrice;
      return GestureDetector(
        onTap: () => widget.onPick(c.depart, roundTrip ? c.ret : null),
        child: Container(
          width: w,
          height: 42,
          margin: const EdgeInsets.all(2),
          decoration: BoxDecoration(
            color: Color.alphaBlend(rc.good.withValues(alpha: shade), Theme.of(context).colorScheme.surface),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: isBest ? rc.good : (current ? rc.accentText : Colors.transparent), width: isBest || current ? 2 : 0),
          ),
          alignment: Alignment.center,
          child: Text(money(c.price, 'EUR', s), style: TextStyle(fontWeight: isBest ? FontWeight.w900 : FontWeight.w700, fontSize: 13)),
        ),
      );
    }

    return Panel(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(Icons.calendar_month_outlined, size: 20, color: rc.accentText),
          const SizedBox(width: 8),
          Expanded(child: Text(s('flexTitle'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
          OutlinedButton(onPressed: _pending ? null : _load, style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)), child: Text(_fresh ? s('flexRefresh') : s('flexShow'))),
        ]),
        Padding(padding: const EdgeInsets.only(top: 4), child: Text(s('flexSub'), style: TextStyle(color: rc.text3, fontSize: 12.5))),
        if (_fresh) ...[
          if (_pending) const Padding(padding: EdgeInsets.only(top: 12), child: LinearProgressIndicator(minHeight: 3)),
          if (best != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => widget.onPick(best.depart, roundTrip ? best.ret : null),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(color: rc.good.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(12)),
                  child: Text.rich(TextSpan(children: [
                    TextSpan(text: '${s('flexCheapest')}: ${money(best.price, 'EUR', s)}', style: const TextStyle(fontWeight: FontWeight.w800)),
                    TextSpan(text: '  ·  ${gridDate(best.depart, s)}${roundTrip ? ' → ${gridDate(best.ret, s)}' : ''}', style: TextStyle(color: rc.text2)),
                  ])),
                ),
              ),
            ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: roundTrip
                ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      SizedBox(width: 78, child: Text(s('flexCorner'), style: TextStyle(fontSize: 10, color: rc.text3, fontWeight: FontWeight.w800))),
                      for (final r in returnDays) SizedBox(width: 86, child: Center(child: Text(gridDate(r, s), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: r == _p.ret ? rc.accentText : rc.text2)))),
                    ]),
                    for (final d in departDays)
                      Row(children: [
                        SizedBox(width: 78, child: Text(gridDate(d, s), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: d == _p.depart ? rc.accentText : rc.text2))),
                        for (final r in returnDays)
                          if (r.compareTo(d) < 0)
                            const SizedBox(width: 86, height: 46)
                          else
                            cell(
                              cells.where((c) => c.depart == d && c.ret == r).firstOrNull,
                              loading: !_loaded('out', d) || !_loaded('in', r),
                              current: d == _p.depart && r == _p.ret,
                              depart: d,
                              ret: r,
                            ),
                      ]),
                  ])
                : Row(children: [
                    for (final d in departDays)
                      Column(children: [
                        Text(gridDate(d, s), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: d == _p.depart ? rc.accentText : rc.text2)),
                        cell(cells.where((c) => c.depart == d).firstOrNull, loading: !_loaded('out', d), current: d == _p.depart, depart: d),
                      ]),
                  ]),
          ),
          Padding(padding: const EdgeInsets.only(top: 10), child: Text(roundTrip ? s('flexNoteRound') : s('flexNoteOne'), style: TextStyle(fontSize: 12, color: rc.text3))),
          if (!_pending && cells.isEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(s('flexEmpty'), style: TextStyle(color: rc.text2))),
        ],
      ]),
    );
  }
}
