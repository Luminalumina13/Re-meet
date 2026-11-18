import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
import '../../ui/flight_card.dart';
import '../../ui/party_picker.dart';
import '../../ui/track_sheet.dart';
import '../search/search_prefill.dart';

enum _Sort { best, cheapest, closest }

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  Airport? _from;
  DatePlan _dates = DatePlan.initial();
  Party _party = const Party();
  double _hours = 4;
  bool _direct = false;
  bool _ideal = true;
  final _budget = TextEditingController();

  bool _loading = false;
  String? _error;
  ExploreResult? _result;
  _Sort _sort = _Sort.best;
  CancelToken? _cancel;

  @override
  void dispose() {
    _cancel?.cancel();
    _budget.dispose();
    super.dispose();
  }

  /// "Anywhere" always needs a return date, so the planner never offers one way here.
  DateRange get _range {
    final r = _dates.range;
    return DateRange(r.depart, r.ret ?? r.depart);
  }

  Json get _request => exploreRequest(
        from: _from!.iata,
        range: _range,
        party: _party,
        maxHours: _hours.round(),
        directOnly: _direct,
        budget: double.tryParse(_budget.text.replaceAll(',', '.')),
        filters: _ideal ? idealFilters(_range.depart) : null,
      );

  bool get _ready => _from != null && _dates.isValid;

  Future<void> _run() async {
    final s = ref.read(stringsProvider);
    if (_from == null) {
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
      final r = await ref.read(apiProvider).explore(_request, cancel: cancel);
      if (mounted && !cancel.isCancelled) setState(() => _result = r);
    } catch (e) {
      if (mounted && !cancel.isCancelled) setState(() => _error = errorText(e, s));
    } finally {
      if (mounted && !cancel.isCancelled) setState(() => _loading = false);
    }
  }

  List<Destination> get _sorted {
    final list = [...?_result?.destinations];
    switch (_sort) {
      case _Sort.best:
        list.sort((a, b) => b.best.rank.compareTo(a.best.rank));
      case _Sort.cheapest:
        list.sort((a, b) => a.cheapest.price.amount.compareTo(b.cheapest.price.amount));
      case _Sort.closest:
        list.sort((a, b) => a.minutesThere.compareTo(b.minutesThere));
    }
    return list;
  }

  void _share() {
    if (_from == null) return;
    final r = _dates.range;
    SharePlus.instance.share(ShareParams(
      text: exploreShareUrl(from: _from!.iata, weekendMode: _dates.weekendMode, saturday: _dates.saturday, shape: _dates.shape, depart: r.depart, ret: r.ret, maxHours: _hours.round(), directOnly: _direct, budget: _budget.text, adults: _party.adults, children: _party.children, infants: _party.infants),
    ));
  }

  void _track() {
    final s = ref.read(stringsProvider);
    showTrackSheet(context, defaultLabel: '${_from!.city} → ✈ ≤ ${_hours.round()} ${s('h')} · ${_range.depart}', params: {'kind': 'explore', 'request': _request});
  }

  void _openDestination(Destination d) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _DestinationSheet(
        d: d,
        divisor: _party.adults + _party.children,
        onAllFlights: () {
          Navigator.of(context).pop();
          ref.read(searchPrefillProvider.notifier).request(SearchPrefill(
                from: _from!,
                to: Airport(iata: d.best.legs.first.to, name: '', city: d.city, country: d.country),
                dates: _dates,
                party: _party,
              ));
          context.go('/search');
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final result = _result;
    final list = _sorted;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          ScreenHeader(title: s('exploreTitle'), subtitle: s('exploreSub')),
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              FieldLabel(s('from')),
              AirportField(value: _from, onChanged: (a) => setState(() => _from = a)),
              const SizedBox(height: 16),
              DatePlanner(plan: _dates, allowOneWay: false, onChanged: (p) => setState(() => _dates = p.copyWith(ret: p.ret ?? p.depart))),
              const SizedBox(height: 16),
              PartyPicker(party: _party, showCabin: false, onChanged: (p) => setState(() => _party = p)),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: FieldLabel(s('maxHours'))),
                Text(s('upTo', {'n': _hours.round()}), style: const TextStyle(fontWeight: FontWeight.w800)),
              ]),
              Slider(value: _hours, min: 1, max: 12, divisions: 11, onChanged: (v) => setState(() => _hours = v)),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(s('directOnly'), style: const TextStyle(fontWeight: FontWeight.w700)), value: _direct, onChanged: (v) => setState(() => _direct = v)),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(s('idealHours'), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(weekday(_range.depart) == 5 ? s('idealHintFriday') : s('idealHint'), style: TextStyle(color: rc.text3, fontSize: 12)),
                value: _ideal,
                onChanged: (v) => setState(() => _ideal = v),
              ),
              FieldLabel(s('budget')),
              TextField(controller: _budget, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(hintText: '—')),
              const SizedBox(height: 16),
              Row(children: [
                IconButton.outlined(onPressed: _from != null ? _share : null, icon: const Icon(Icons.ios_share, size: 20), tooltip: s('share'), style: IconButton.styleFrom(minimumSize: const Size(50, 50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
                const SizedBox(width: 10),
                Expanded(child: SubmitButton(icon: Icons.explore_outlined, idle: s('find'), busy: s('finding'), loading: _loading, onPressed: _run)),
              ]),
              if (_error != null) ErrorBox(message: _error!, onRetry: _ready ? _run : null),
            ]),
          ),
          if (_loading && result == null) LoadingNote(s('finding')),
          if (result != null) ...[
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: Text('${_from?.city ?? ''} · ${result.destinations.length} ${s('destinations')} · ✈ ≤ ${_hours.round()} ${s('h')}', style: TextStyle(color: rc.text2, fontWeight: FontWeight.w700))),
              IconButton(tooltip: s('track'), icon: const Icon(Icons.notifications_none), onPressed: _from == null ? null : _track),
            ]),
            SizedBox(
              height: 38,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                for (final k in _Sort.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(label: Text(switch (k) { _Sort.best => s('sortBest'), _Sort.cheapest => s('sortCheapest'), _Sort.closest => s('sortFastest') }), selected: _sort == k, onSelected: (_) => setState(() => _sort = k)),
                  ),
              ]),
            ),
            const SizedBox(height: 12),
            if (list.isEmpty) Panel(child: Center(child: Text(s('noResults'), style: TextStyle(color: rc.text2)))),
            for (final d in list) Padding(padding: const EdgeInsets.only(bottom: 12), child: _DestinationCard(d: d, onTap: () => _openDestination(d))),
            Padding(padding: const EdgeInsets.only(top: 8), child: Text(s('pricesNote'), style: TextStyle(color: rc.text3, fontSize: 12))),
          ],
        ],
      ),
    );
  }
}

class _DestinationCard extends ConsumerWidget {
  const _DestinationCard({required this.d, required this.onTap});
  final Destination d;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final price = d.best.price;
    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: Material(
        color: Theme.of(context).colorScheme.surface,
        child: InkWell(
          onTap: onTap,
          child: Container(
            decoration: BoxDecoration(border: Border.all(color: rc.border), borderRadius: BorderRadius.circular(18)),
            child: Column(children: [
              SizedBox(
                height: 120,
                width: double.infinity,
                child: Stack(fit: StackFit.expand, children: [
                  _Photo(url: d.imageUrl, seed: d.city),
                  const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0xCC000000)]))),
                  Positioned(
                    left: 14,
                    right: 14,
                    bottom: 10,
                    child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(d.city, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
                          Text('${d.country} · ${d.airports.join(', ')}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                        ]),
                      ),
                      Text(money(price.amount, price.currency, s), style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                    ]),
                  ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Pill('${s('flightTime')} ${duration(d.minutesThere, s)}', icon: Icons.schedule),
                  const SizedBox(width: 8),
                  if (d.best.isDirect) Pill(s('direct'), color: rc.good, background: rc.good.withValues(alpha: 0.14)),
                  const Spacer(),
                  Text('${d.options} ${s('options')}', style: TextStyle(color: rc.text3, fontSize: 12, fontWeight: FontWeight.w700)),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Destination photo with a gradient fallback (offline, or a broken link).
class _Photo extends StatelessWidget {
  const _Photo({required this.url, required this.seed});
  final String? url;
  final String seed;

  @override
  Widget build(BuildContext context) {
    final rc = context.rc;
    final hue = (seed.codeUnits.fold<int>(0, (a, b) => a + b) * 37) % 360;
    final fallback = DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(colors: [HSLColor.fromAHSL(1, hue.toDouble(), 0.55, 0.45).toColor(), rc.series[0]])));
    if (url == null || url!.isEmpty) return fallback;
    return Image.network(url!, fit: BoxFit.cover, errorBuilder: (_, _, _) => fallback, loadingBuilder: (c, child, p) => p == null ? child : fallback);
  }
}

class _DestinationSheet extends ConsumerWidget {
  const _DestinationSheet({required this.d, required this.divisor, required this.onAllFlights});
  final Destination d;
  final int divisor;
  final VoidCallback onAllFlights;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      builder: (context, scroll) => ListView(controller: scroll, padding: const EdgeInsets.fromLTRB(16, 0, 16, 24), children: [
        Text('${d.city}, ${d.country}', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        FieldLabel(s('bestFlight')),
        FlightCard(it: d.best, perPersonDivisor: divisor, highlight: true),
        if (d.cheapest.id != d.best.id) ...[
          const SizedBox(height: 12),
          FieldLabel(s('cheapestFlight')),
          FlightCard(it: d.cheapest, perPersonDivisor: divisor),
        ],
        const SizedBox(height: 16),
        OutlinedButton.icon(onPressed: onAllFlights, icon: const Icon(Icons.search, size: 18), label: Text(s('allFlights'))),
      ]),
    );
  }
}
