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
import '../../ui/flight_card.dart';
import '../../ui/links.dart';
import '../../ui/track_sheet.dart';

class _FriendDraft {
  _FriendDraft(this.id) : name = TextEditingController();
  final String id;
  final TextEditingController name;
  List<Airport?> origins = [null];
  void dispose() => name.dispose();
}

class MeetupScreen extends ConsumerStatefulWidget {
  const MeetupScreen({super.key});

  @override
  ConsumerState<MeetupScreen> createState() => _MeetupScreenState();
}

class _MeetupScreenState extends ConsumerState<MeetupScreen> {
  static const _maxFriends = 6;
  static const _maxAirports = 4;
  static const _maxPlaces = 4;

  int _seq = 0;
  late final List<_FriendDraft> _friends = [_FriendDraft('f${++_seq}'), _FriendDraft('f${++_seq}')];
  final List<Airport?> _places = [null];
  bool _includeOrigins = false;
  DatePlan _dates = DatePlan.initial();
  int _prio = 15;
  bool _ideal = true;
  final _budget = TextEditingController();

  bool _loading = false;
  String? _error;
  MeetupResult? _result;
  CancelToken? _cancel;

  @override
  void dispose() {
    _cancel?.cancel();
    for (final f in _friends) {
      f.dispose();
    }
    _budget.dispose();
    super.dispose();
  }

  DateRange get _range {
    final r = _dates.range;
    return DateRange(r.depart, r.ret ?? r.depart);
  }

  List<({String id, String name, List<String> origins})> get _validFriends => [
        for (final f in _friends)
          if (f.name.text.trim().isNotEmpty && f.origins.whereType<Airport>().isNotEmpty) (id: f.id, name: f.name.text.trim(), origins: f.origins.whereType<Airport>().map((a) => a.iata).toSet().toList()),
      ];

  List<String> get _destinations {
    final set = <String>{..._places.whereType<Airport>().map((a) => a.iata)};
    if (_includeOrigins) {
      for (final f in _validFriends) {
        set.addAll(f.origins);
      }
    }
    return set.take(6).toList();
  }

  bool get _valid => _validFriends.length >= 2 && _destinations.isNotEmpty && _dates.isValid;

  Json get _request => meetupRequest(friends: _validFriends, destinations: _destinations, range: _range, valuePerHour: _prio, budget: double.tryParse(_budget.text.replaceAll(',', '.')), filters: _ideal ? idealFilters(_range.depart) : null);

  Future<void> _run() async {
    final s = ref.read(stringsProvider);
    if (_validFriends.length < 2) {
      setState(() => _error = s('errNeedFriends'));
      return;
    }
    if (_destinations.isEmpty) {
      setState(() => _error = s('errNeedPlace'));
      return;
    }
    if (!_valid) return;
    _cancel?.cancel();
    final cancel = CancelToken();
    _cancel = cancel;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final r = await ref.read(apiProvider).meetup(_request, cancel: cancel);
      if (mounted && !cancel.isCancelled) setState(() => _result = r);
    } catch (e) {
      if (mounted && !cancel.isCancelled) setState(() => _error = errorText(e, s));
    } finally {
      if (mounted && !cancel.isCancelled) setState(() => _loading = false);
    }
  }

  void _share() {
    final r = _dates.range;
    SharePlus.instance.share(ShareParams(
      text: meetupShareUrl(
        friends: [for (final f in _friends) (name: f.name.text, origins: f.origins.whereType<Airport>().map((a) => a.iata).toList())],
        destinations: _places.whereType<Airport>().map((a) => a.iata).toList(),
        weekendMode: _dates.weekendMode,
        saturday: _dates.saturday,
        shape: _dates.shape,
        depart: r.depart,
        ret: r.ret,
        valuePerHour: _prio,
        budget: _budget.text,
        includeOrigins: _includeOrigins,
      ),
    ));
  }

  void _track() {
    final s = ref.read(stringsProvider);
    final places = _destinations.join('/');
    showTrackSheet(context, defaultLabel: '${s('tabMeetup')}: $places · ${_range.depart}', params: {'kind': 'meetup', 'request': _request}, currentPrice: _result?.plans.isEmpty ?? true ? null : _result!.plans.first.totalPrice);
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final result = _result;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          ScreenHeader(title: s('meetupTitle'), subtitle: s('meetupSub')),
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Icon(Icons.groups_outlined, size: 20, color: rc.accentText), const SizedBox(width: 8), Text(s('friends'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))]),
              const SizedBox(height: 10),
              for (var i = 0; i < _friends.length; i++) _friendEditor(i, s, rc),
              if (_friends.length < _maxFriends)
                TextButton.icon(onPressed: () => setState(() => _friends.add(_FriendDraft('f${++_seq}'))), icon: const Icon(Icons.add, size: 18), label: Text(s('addFriend'))),
              const SizedBox(height: 8),
              FieldLabel(s('whereMeet')),
              for (var i = 0; i < _places.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    Expanded(child: AirportField(value: _places[i], icon: Icons.flight_land, onChanged: (a) => setState(() => _places[i] = a))),
                    if (_places.length > 1) IconButton(icon: const Icon(Icons.delete_outline), tooltip: s('delete'), onPressed: () => setState(() => _places.removeAt(i))),
                  ]),
                ),
              if (_places.length < _maxPlaces) TextButton.icon(onPressed: () => setState(() => _places.add(null)), icon: const Icon(Icons.add, size: 18), label: Text(s('addPlace'))),
              SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(s('includeOrigins'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)), value: _includeOrigins, onChanged: (v) => setState(() => _includeOrigins = v)),
              const SizedBox(height: 8),
              DatePlanner(plan: _dates, allowOneWay: false, onChanged: (p) => setState(() => _dates = p.copyWith(ret: p.ret ?? p.depart))),
              const SizedBox(height: 16),
              FieldLabel(s('priority')),
              SegmentedButton<int>(
                showSelectedIcon: false,
                segments: [ButtonSegment(value: 5, label: Text(s('prioCheap'))), ButtonSegment(value: 15, label: Text(s('prioBalanced'))), ButtonSegment(value: 40, label: Text(s('prioTime')))],
                selected: {_prio},
                onSelectionChanged: (v) => setState(() => _prio = v.first),
              ),
              Padding(padding: const EdgeInsets.only(top: 8), child: Text(s('prioSentence', {'amount': money(_prio, 'EUR', s)}), style: TextStyle(color: rc.text2, fontSize: 13))),
              const SizedBox(height: 8),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(s('idealHours'), style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(weekday(_range.depart) == 5 ? s('idealHintFriday') : s('idealHint'), style: TextStyle(color: rc.text3, fontSize: 12)),
                value: _ideal,
                onChanged: (v) => setState(() => _ideal = v),
              ),
              FieldLabel('${s('budget')} · ${s('perPerson')}'),
              TextField(controller: _budget, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(hintText: '—')),
              const SizedBox(height: 16),
              Row(children: [
                IconButton.outlined(onPressed: _share, icon: const Icon(Icons.ios_share, size: 20), tooltip: s('share'), style: IconButton.styleFrom(minimumSize: const Size(50, 50), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)))),
                const SizedBox(width: 10),
                Expanded(child: SubmitButton(icon: Icons.group_outlined, idle: s('plan'), busy: s('planning'), loading: _loading, onPressed: _run)),
              ]),
              if (_error != null) ErrorBox(message: _error!, onRetry: _valid ? _run : null),
            ]),
          ),
          if (_loading && result == null) LoadingNote(s('planning')),
          if (result != null) ...[
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: Text('${result.plans.length} ${s('results')}', style: TextStyle(color: rc.text2, fontWeight: FontWeight.w700))),
              TextButton.icon(onPressed: result.plans.isEmpty ? null : _track, icon: const Icon(Icons.notifications_none, size: 18), label: Text(s('track'))),
            ]),
            if (result.unreachable > 0) Padding(padding: const EdgeInsets.only(bottom: 8), child: Text(s('someUnreachable'), style: TextStyle(color: rc.warn, fontSize: 12.5, fontWeight: FontWeight.w600))),
            if (result.plans.isEmpty) Panel(child: Center(child: Text(s('noResults'), style: TextStyle(color: rc.text2)))),
            for (var i = 0; i < result.plans.length; i++) Padding(padding: const EdgeInsets.only(bottom: 12), child: _PlanCard(plan: result.plans[i], highlight: i == 0)),
            Padding(padding: const EdgeInsets.only(top: 8), child: Text(s('pricesNote'), style: TextStyle(color: rc.text3, fontSize: 12))),
          ],
        ],
      ),
    );
  }

  Widget _friendEditor(int i, Strings s, RemeetColors rc) {
    final f = _friends[i];
    final color = rc.series[i % rc.series.length];
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(top: 18, right: 10), child: CircleAvatar(radius: 6, backgroundColor: color)),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextField(controller: f.name, textCapitalization: TextCapitalization.words, decoration: InputDecoration(hintText: s('friendName')), onChanged: (_) => setState(() {})),
            const SizedBox(height: 8),
            for (var k = 0; k < f.origins.length; k++)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AirportField(
                  value: f.origins[k],
                  onChanged: (a) => setState(() => f.origins[k] = a),
                  onRemove: f.origins.length > 1 ? () => setState(() => f.origins.removeAt(k)) : null,
                ),
              ),
            if (f.origins.length < _maxAirports) Align(alignment: Alignment.centerLeft, child: TextButton.icon(onPressed: () => setState(() => f.origins.add(null)), icon: const Icon(Icons.add, size: 16), label: Text(s('addAirport')))),
          ]),
        ),
        if (_friends.length > 2)
          IconButton(
            tooltip: s('delete'),
            icon: const Icon(Icons.delete_outline),
            onPressed: () => setState(() {
              _friends.removeAt(i).dispose();
            }),
          ),
      ]),
    );
  }
}

class _PlanCard extends ConsumerWidget {
  const _PlanCard({required this.plan, required this.highlight});
  final MeetupPlan plan;
  final bool highlight;

  String get _city {
    for (final f in plan.friends) {
      final c = f.outbound?.legs.first.toCity;
      if (c != null && c.isNotEmpty) return c;
    }
    return plan.destination;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final travellers = plan.friends.where((f) => !f.isHost).toList();
    return Panel(
      highlight: highlight,
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (highlight) Padding(padding: const EdgeInsets.only(bottom: 6), child: Pill(s('bestPlan'))),
              Text('$_city (${plan.destination})', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
              Text('${shortDate(plan.meetStartLocal, s)} ${clock(plan.meetStartLocal)} → ${shortDate(plan.meetEndLocal, s)} ${clock(plan.meetEndLocal)}', style: TextStyle(color: rc.text3, fontSize: 12)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(money(plan.totalPrice, plan.currency, s), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            Text('${s('totalPrice')} · ${money(plan.totalPrice / (plan.friends.isEmpty ? 1 : plan.friends.length), plan.currency, s)} ${s('perPerson')}', style: TextStyle(color: rc.text3, fontSize: 11.5)),
          ]),
        ]),
        const SizedBox(height: 10),
        Pill('${duration(plan.togetherMinutes, s)} ${s('together')}', icon: Icons.schedule, color: rc.good, background: rc.good.withValues(alpha: 0.14)),
        const SizedBox(height: 12),
        if (travellers.isNotEmpty) _Timeline(plan: plan),
        const SizedBox(height: 6),
        Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            tilePadding: EdgeInsets.zero,
            childrenPadding: EdgeInsets.zero,
            title: Text(s('planFor', {'n': plan.friends.length}), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            children: [
              for (var i = 0; i < plan.friends.length; i++) _friendTickets(context, plan.friends[i], rc.series[i % rc.series.length], s),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _friendTickets(BuildContext context, FriendPlan f, Color color, Strings s) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          CircleAvatar(radius: 5, backgroundColor: color),
          const SizedBox(width: 8),
          Expanded(child: Text(f.friend.name, style: const TextStyle(fontWeight: FontWeight.w800))),
          Text(f.isHost ? s('host') : money(f.price, plan.currency, s), style: const TextStyle(fontWeight: FontWeight.w800)),
        ]),
        if (!f.isHost) ...[
          const SizedBox(height: 8),
          if (f.outbound != null) LegRow(leg: f.outbound!.legs.first, compact: true),
          const SizedBox(height: 8),
          if (f.inbound != null) LegRow(leg: f.inbound!.legs.first, compact: true),
          const SizedBox(height: 6),
          Row(children: [
            if (f.outbound?.deepLink != null) TextButton(onPressed: () => openLink(context, f.outbound!.deepLink), child: Text('${s('open')} →')),
            if (f.inbound?.deepLink != null) TextButton(onPressed: () => openLink(context, f.inbound!.deepLink), child: Text('${s('open')} ←')),
          ]),
        ],
      ]),
    );
  }
}

/// Who is at the destination when: one bar per friend, a shaded band for the time everyone is together.
class _Timeline extends StatelessWidget {
  const _Timeline({required this.plan});
  final MeetupPlan plan;

  /// White or dark text, whichever reads better on the bar colour.
  Color _ink(Color bg) => bg.computeLuminance() > 0.45 ? const Color(0xFF1E293B) : Colors.white;

  @override
  Widget build(BuildContext context) {
    final rc = context.rc;
    final rows = [
      for (var i = 0; i < plan.friends.length; i++)
        if (!plan.friends[i].isHost) (i: i, f: plan.friends[i], arrive: DateTime.parse(plan.friends[i].arriveUtc!), leave: DateTime.parse(plan.friends[i].departUtc!)),
    ];
    final start = rows.map((r) => r.arrive).reduce((a, b) => a.isBefore(b) ? a : b);
    final end = rows.map((r) => r.leave).reduce((a, b) => a.isAfter(b) ? a : b);
    final span = end.difference(start).inMinutes.clamp(1, 1 << 30);
    double at(DateTime t) => (t.difference(start).inMinutes / span).clamp(0.0, 1.0);
    final meetFrom = at(DateTime.parse(plan.meetStartUtc));
    final meetTo = at(DateTime.parse(plan.meetEndUtc));
    return LayoutBuilder(builder: (context, c) {
      final w = c.maxWidth;
      return Stack(children: [
        Positioned(
          left: meetFrom * w,
          width: ((meetTo - meetFrom) * w).clamp(2.0, w),
          top: 0,
          bottom: 0,
          child: Container(decoration: BoxDecoration(color: rc.good.withValues(alpha: 0.10), border: Border.symmetric(vertical: BorderSide(color: rc.good.withValues(alpha: 0.6), width: 1.5)))),
        ),
        Column(children: [
          for (final r in rows)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: SizedBox(
                height: 24,
                width: w,
                child: Stack(children: [
                  Positioned(
                    left: at(r.arrive) * w,
                    width: ((at(r.leave) - at(r.arrive)) * w).clamp(8.0, w),
                    top: 0,
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(color: rc.series[r.i % rc.series.length], borderRadius: BorderRadius.circular(7)),
                      alignment: Alignment.centerLeft,
                      child: Text(clock(r.f.outbound!.legs.first.arriveLocal), maxLines: 1, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _ink(rc.series[r.i % rc.series.length]))),
                    ),
                  ),
                ]),
              ),
            ),
        ]),
      ]);
    });
  }
}
