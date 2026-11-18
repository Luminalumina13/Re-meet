import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/theme.dart';
import '../core/dates.dart';
import '../core/format.dart';
import '../core/strings.dart';

/// Which dates the user picked: a weekend (a Saturday plus a shape such as Fri–Mon) or exact dates.
class DatePlan {
  const DatePlan({required this.weekendMode, required this.saturday, required this.shape, required this.depart, this.ret});

  factory DatePlan.initial({DateTime? now}) {
    final sat = nextSaturday(todayIso(now));
    return DatePlan(weekendMode: true, saturday: sat, shape: WeekendShape.satSun, depart: sat, ret: addDays(sat, 1));
  }

  final bool weekendMode;
  final String saturday;
  final WeekendShape shape;
  final String depart;

  /// Null means one way (only possible in exact-dates mode).
  final String? ret;

  DateRange get range => weekendMode ? weekendFrom(saturday, shape) : DateRange(depart, ret);

  bool get isValid => ret == null || ret!.compareTo(depart) >= 0;

  DatePlan copyWith({bool? weekendMode, String? saturday, WeekendShape? shape, String? depart, Object? ret = _keep}) => DatePlan(
        weekendMode: weekendMode ?? this.weekendMode,
        saturday: saturday ?? this.saturday,
        shape: shape ?? this.shape,
        depart: depart ?? this.depart,
        ret: identical(ret, _keep) ? this.ret : ret as String?,
      );
}

const Object _keep = Object();

String shapeLabel(WeekendShape shape, Strings s) => switch (shape) {
      WeekendShape.satSun => s('shapeSatSun'),
      WeekendShape.friSun => s('shapeFriSun'),
      WeekendShape.satMon => s('shapeSatMon'),
      WeekendShape.friMon => s('shapeFriMon'),
      WeekendShape.thuSun => s('shapeThuSun'),
    };

class DatePlanner extends ConsumerWidget {
  const DatePlanner({super.key, required this.plan, required this.onChanged, this.allowOneWay = true});
  final DatePlan plan;
  final ValueChanged<DatePlan> onChanged;

  /// "Explore" and the meetup planner always need a return date.
  final bool allowOneWay;

  Future<void> _pick(BuildContext context, {required bool isReturn}) async {
    final today = DateTime.now();
    final first = DateTime(today.year, today.month, today.day);
    final current = parseIso(isReturn ? (plan.ret ?? plan.depart) : plan.depart);
    final picked = await showDatePicker(
      context: context,
      initialDate: current.isBefore(first) ? first : DateTime(current.year, current.month, current.day),
      firstDate: isReturn ? parseIso(plan.depart) : first,
      lastDate: first.add(const Duration(days: 365)),
    );
    if (picked == null) return;
    final iso = toIso(DateTime.utc(picked.year, picked.month, picked.day));
    if (isReturn) {
      onChanged(plan.copyWith(ret: iso));
    } else {
      // Moving the departure past the return drags the return along.
      onChanged(plan.copyWith(depart: iso, ret: plan.ret != null && plan.ret!.compareTo(iso) < 0 ? iso : plan.ret));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final saturdays = upcomingSaturdays(todayIso());
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SegmentedButton<bool>(
        showSelectedIcon: false,
        segments: [ButtonSegment(value: true, label: Text(s('weekend'))), ButtonSegment(value: false, label: Text(s('customDates')))],
        selected: {plan.weekendMode},
        onSelectionChanged: (v) => onChanged(plan.copyWith(weekendMode: v.first)),
      ),
      const SizedBox(height: 12),
      if (plan.weekendMode) ...[
        SizedBox(
          height: 38,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            for (final sh in WeekendShape.values)
              Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(shapeLabel(sh, s)), selected: plan.shape == sh, onSelected: (_) => onChanged(plan.copyWith(shape: sh)))),
          ]),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 38,
          child: ListView(scrollDirection: Axis.horizontal, children: [
            for (final sat in saturdays)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(dateRange(weekendFrom(sat, plan.shape).depart, weekendFrom(sat, plan.shape).ret, s)),
                  selected: plan.saturday == sat,
                  onSelected: (_) => onChanged(plan.copyWith(saturday: sat)),
                ),
              ),
          ]),
        ),
      ] else
        Row(children: [
          Expanded(child: _DateButton(label: s('depart'), value: shortDate(plan.depart, s), onTap: () => _pick(context, isReturn: false))),
          const SizedBox(width: 10),
          Expanded(
            child: _DateButton(
              label: s('ret'),
              value: plan.ret == null ? s('oneWay') : shortDate(plan.ret!, s),
              muted: plan.ret == null,
              onTap: () => _pick(context, isReturn: true),
              onClear: allowOneWay && plan.ret != null ? () => onChanged(plan.copyWith(ret: null)) : null,
            ),
          ),
        ]),
      if (!plan.isValid) Padding(padding: const EdgeInsets.only(top: 8), child: Text(s('errReturnBefore'), style: TextStyle(color: rc.crit, fontWeight: FontWeight.w600))),
    ]);
  }
}

class _DateButton extends StatelessWidget {
  const _DateButton({required this.label, required this.value, required this.onTap, this.onClear, this.muted = false});
  final String label;
  final String value;
  final VoidCallback onTap;
  final VoidCallback? onClear;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final rc = context.rc;
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Ink(
        padding: const EdgeInsets.fromLTRB(14, 8, 6, 8),
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: rc.border)),
        child: Row(children: [
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(label.toUpperCase(), style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: rc.text3, letterSpacing: 0.5)),
              Text(value, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: muted ? rc.text3 : null)),
            ]),
          ),
          if (onClear != null) IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.close, size: 18), onPressed: onClear) else const SizedBox(width: 8),
        ]),
      ),
    );
  }
}
