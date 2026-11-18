import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/theme.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/strings.dart';

/// Airport input with suggestions from the backend as you type (Ukrainian and English names work).
class AirportField extends ConsumerStatefulWidget {
  const AirportField({super.key, required this.value, required this.onChanged, this.icon = Icons.flight_takeoff, this.onRemove});
  final Airport? value;

  /// Called with the chosen airport, or null as soon as the text no longer matches one.
  final ValueChanged<Airport?> onChanged;
  final IconData icon;

  /// Shows a small remove button when set.
  final VoidCallback? onRemove;

  @override
  ConsumerState<AirportField> createState() => _AirportFieldState();
}

class _AirportFieldState extends ConsumerState<AirportField> {
  late final TextEditingController _ctrl = TextEditingController(text: widget.value?.label ?? '');
  final FocusNode _focus = FocusNode();
  int _seq = 0;

  /// The label of the airport just chosen from the list. Picking one writes its label into the field,
  /// which would otherwise trigger a new search and pop the suggestions up again.
  String? _picked;

  @override
  void didUpdateWidget(AirportField old) {
    super.didUpdateWidget(old);
    final label = widget.value?.label ?? '';
    // The parent changed the value from outside (swap, prefill): show it.
    if (widget.value != old.value && _ctrl.text != label && (widget.value != null || !_focus.hasFocus)) _ctrl.text = label;
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  Future<Iterable<Airport>> _options(TextEditingValue v) async {
    final q = v.text.trim();
    if (q.isEmpty || q == widget.value?.label) return const [];
    final mine = ++_seq;
    await Future<void>.delayed(const Duration(milliseconds: 250)); // wait for a pause in typing
    // Stale (typing went on), or this text is just the airport that was picked a moment ago.
    if (mine != _seq || q == _picked || q == widget.value?.label) return const [];
    try {
      return await ref.read(apiProvider).airports(q);
    } catch (_) {
      return const [];
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    return RawAutocomplete<Airport>(
      textEditingController: _ctrl,
      focusNode: _focus,
      optionsBuilder: _options,
      displayStringForOption: (a) => a.label,
      onSelected: (a) {
        _picked = a.label;
        widget.onChanged(a);
      },
      fieldViewBuilder: (context, ctrl, focus, onSubmit) => TextField(
        controller: ctrl,
        focusNode: focus,
        textInputAction: TextInputAction.next,
        autocorrect: false,
        decoration: InputDecoration(
          hintText: s('airportHint'),
          prefixIcon: Icon(widget.icon, size: 20, color: rc.text3),
          suffixIcon: widget.onRemove == null ? null : IconButton(icon: const Icon(Icons.close, size: 18), tooltip: s('removeAirport'), onPressed: widget.onRemove),
        ),
        onChanged: (t) {
          if (widget.value != null && t != widget.value!.label) widget.onChanged(null);
        },
        onSubmitted: (_) => onSubmit(),
      ),
      optionsViewBuilder: (context, onSelected, options) => Align(
        alignment: Alignment.topLeft,
        child: Material(
          elevation: 6,
          borderRadius: BorderRadius.circular(14),
          color: Theme.of(context).colorScheme.surface,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: 280, maxWidth: MediaQuery.sizeOf(context).width - 32),
            child: ListView.builder(
              padding: EdgeInsets.zero,
              shrinkWrap: true,
              itemCount: options.length,
              itemBuilder: (context, i) {
                final a = options.elementAt(i);
                return ListTile(
                  dense: true,
                  title: Text('${a.city} · ${a.name}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
                  trailing: Text(a.iata, style: TextStyle(color: rc.text2, fontWeight: FontWeight.w800)),
                  onTap: () => onSelected(a),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
