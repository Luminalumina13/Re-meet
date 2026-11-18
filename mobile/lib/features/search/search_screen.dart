import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/theme.dart';
import '../../core/api.dart';
import '../../core/dates.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/requests.dart';
import '../../core/share.dart';
import '../../core/strings.dart';
import '../../ui/airport_field.dart';
import '../../ui/common.dart';
import '../../ui/date_planner.dart';
import '../../ui/flex_dates_card.dart';
import '../../ui/flight_card.dart';
import '../../ui/party_picker.dart';
import '../../ui/track_sheet.dart';
import 'search_prefill.dart';

enum _Sort { best, cheapest, fastest, comfort }

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  static const _page = 15;

  Airport? _from;
  Airport? _to;
  DatePlan _dates = DatePlan.initial();
  Party _party = const Party();
  bool _ideal = true;

  bool _loading = false;
  String? _error;
  SearchResult? _result;
  _Sort _sort = _Sort.best;
  int _visible = _page;
  CancelToken? _cancel;

  @override
  void dispose() {
    _cancel?.cancel();
    super.dispose();
  }

  TimeFilters? get _filters => _ideal ? idealFilters(_dates.range.depart) : null;

  bool get _ready => _from != null && _to != null && _from!.iata != _to!.iata && _dates.isValid;

  Json get _request => searchRequest(from: _from!.iata, to: _to!.iata, range: _dates.range, party: _party, filters: _filters);

  Future<void> _run() async {
    final s = ref.read(stringsProvider);
    if (_from == null || _to == null) {
      setState(() => _error = s('errPickAirports'));
      return;
    }
    if (!_ready) return;
    _cancel?.cancel();
    final cancel = CancelToken();
    _cancel = cancel;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await ref.read(apiProvider).search(_request, cancel: cancel);
      if (!mounted || cancel.isCancelled) return;
      setState(() {
        _result = r;
        _visible = _page;
      });
    } catch (e) {
      if (mounted && !cancel.isCancelled) setState(() => _error = errorText(e, s));
    } finally {
      if (mounted && !cancel.isCancelled) setState(() => _loading = false);
    }
  }

  void _applyPrefill(SearchPrefill p) {
    setState(() {
      _from = p.from;
      _to = p.to;
      _dates = p.dates;
      _party = p.party;
    });
    _run();
  }

  List<Itinerary> get _sorted {
    final list = [...?_result?.itineraries];
    switch (_sort) {
      case _Sort.best:
        list.sort((a, b) => b.rank.compareTo(a.rank));
      case _Sort.cheapest:
        list.sort((a, b) => a.price.amount.compareTo(b.price.amount));
      case _Sort.fastest:
        list.sort((a, b) => a.totalMinutes.compareTo(b.totalMinutes));
      case _Sort.comfort:
        list.sort((a, b) => b.comfort.compareTo(a.comfort));
    }
    return list;
  }

  void _share() {
    if (_from == null || _to == null) return;
    final r = _dates.range;
    final url = searchShareUrl(from: _from!.iata, to: _to!.iata, weekendMode: _dates.weekendMode, saturday: _dates.saturday, shape: _dates.shape, depart: r.depart, ret: r.ret, adults: _party.adults, children: _party.children, infants: _party.infants, cabin: _party.cabin);
    SharePlus.instance.share(ShareParams(text: url));
  }

  void _track(Itinerary it) {
    final s = ref.read(stringsProvider);
    final r = _dates.range;
    showTrackSheet(
      context,
      defaultLabel: '${_from!.city} → ${_to!.city} · ${dateRange(r.depart, r.ret, s)}',
      params: {'kind': 'search', 'request': _request},
      currentPrice: it.price.amount,
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    ref.listen(searchPrefillProvider, (prev, next) {
      if (next != null) {
        _applyPrefill(next);
        ref.read(searchPrefillProvider.notifier).clear();
      }
    });

    final result = _result;
    final sorted = _sorted;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          ScreenHeader(eyebrow: s('slogan'), title: s('searchTitle'), subtitle: s('searchSub')),
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              FieldLabel(s('from')),
              AirportField(value: _from, onChanged: (a) => setState(() => _from = a)),
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  tooltip: 'swap',
                  icon: const Icon(Icons.swap_vert),
                  onPressed: () => setState(() {
                    final t = _from;
                    _from = _to;
                    _to = t;
                  }),
                ),
              ),
              FieldLabel(s('to')),
              AirportField(value: _to, icon: Icons.flight_land, onChanged: (a) => setState(() => _to = a)),
              const SizedBox(height: 16),
              DatePlanner(plan: _dates, onChanged: (p) => setState(() => _dates = p)),
              const SizedBox(height: 16),
              PartyPicker(party: _party, onChanged: (p) => setState(() => _party = p)),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(s('idealHours'), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(weekday(_dates.range.depart) == 5 ? s('idealHintFriday') : s('idealHint'), style: TextStyle(color: rc.text3, fontSize: 12)),
                value: _ideal,
                onChanged: (v) => setState(() => _ideal = v),
              ),
              const SizedBox(height: 8),
              Row(children: [
                IconButton.outlined(onPressed: _from != null && _to != null ? _share : null, icon: const Icon(Icons.ios_share, size: 20), tooltip: s('share'), style: IconButton.styleFrom(minimumSize: const Size(50, 50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
                const SizedBox(width: 10),
                Expanded(child: SubmitButton(icon: Icons.search, idle: s('search'), busy: s('searching'), loading: _loading, onPressed: _run)),
              ]),
              if (_error != null) ErrorBox(message: _error!, onRetry: _ready ? _run : null),
            ]),
          ),
          if (_ready) ...[
            const SizedBox(height: 16),
            FlexDatesCard(
              params: FlexParams(from: _from!.iata, to: _to!.iata, depart: _dates.range.depart, ret: _dates.range.ret, party: _party, filters: _filters),
              onPick: (depart, ret) {
                setState(() => _dates = _dates.copyWith(weekendMode: false, depart: depart, ret: ret));
                _run();
              },
            ),
          ],
          if (_loading && result == null) LoadingNote(s('searching')),
          if (result != null) ...[
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: Text('${result.itineraries.length} ${s('results')}${result.cached ? ' · ${s('cached')}' : ''}', style: TextStyle(color: rc.text2, fontWeight: FontWeight.w700))),
            ]),
            const SizedBox(height: 8),
            SizedBox(
              height: 38,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                for (final k in _Sort.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(switch (k) { _Sort.best => s('sortBest'), _Sort.cheapest => s('sortCheapest'), _Sort.fastest => s('sortFastest'), _Sort.comfort => s('sortComfort') }),
                      selected: _sort == k,
                      onSelected: (_) => setState(() => _sort = k),
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: 12),
            if (sorted.isEmpty)
              Panel(child: Center(child: Text(s('noResults'), style: TextStyle(color: rc.text2))))
            else
              for (final it in sorted.take(_visible)) Padding(padding: const EdgeInsets.only(bottom: 12), child: FlightCard(it: it, perPersonDivisor: _party.adults + _party.children, onTrack: () => _track(it))),
            if (sorted.length > _visible) Center(child: OutlinedButton(onPressed: () => setState(() => _visible += _page), child: Text(s('showMore')))),
            Padding(padding: const EdgeInsets.only(top: 16), child: Text(s('pricesNote'), style: TextStyle(color: rc.text3, fontSize: 12))),
          ],
        ],
      ),
    );
  }
}
