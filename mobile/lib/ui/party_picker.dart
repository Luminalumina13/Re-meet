import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/theme.dart';
import '../core/requests.dart';
import '../core/strings.dart';
import 'common.dart';

/// Adults, children, infants and (optionally) the cabin class.
class PartyPicker extends ConsumerWidget {
  const PartyPicker({super.key, required this.party, required this.onChanged, this.showCabin = true});
  final Party party;
  final ValueChanged<Party> onChanged;
  final bool showCabin;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    Widget stepper(String label, int value, int min, int max, ValueChanged<int> set) => _Stepper(label: label, value: value, canDec: value > min, canInc: value < max, onChanged: set);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Wrap(spacing: 10, runSpacing: 10, children: [
        stepper(s('adults'), party.adults, 1, 9, (v) => onChanged(party.copyWith(adults: v))),
        stepper(s('children'), party.children, 0, 8, (v) => onChanged(party.copyWith(children: v))),
        stepper(s('infants'), party.infants, 0, 4, (v) => onChanged(party.copyWith(infants: v))),
      ]),
      if (showCabin) ...[
        const SizedBox(height: 14),
        FieldLabel(s('cabin')),
        DropdownButtonFormField<String>(
          initialValue: party.cabin,
          isExpanded: true,
          decoration: const InputDecoration(),
          items: [for (final c in const ['economy', 'premium_economy', 'business', 'first']) DropdownMenuItem(value: c, child: Text(s(c)))],
          onChanged: (c) => onChanged(party.copyWith(cabin: c)),
        ),
      ],
    ]);
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.label, required this.value, required this.canDec, required this.canInc, required this.onChanged});
  final String label;
  final int value;
  final bool canDec;
  final bool canInc;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final rc = context.rc;
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
      decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(14), border: Border.all(color: rc.border)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: rc.text3)),
          Text('$value', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        ]),
        const SizedBox(width: 8),
        IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.remove_circle_outline), onPressed: canDec ? () => onChanged(value - 1) : null),
        IconButton(visualDensity: VisualDensity.compact, icon: const Icon(Icons.add_circle_outline), onPressed: canInc ? () => onChanged(value + 1) : null),
      ]),
    );
  }
}
