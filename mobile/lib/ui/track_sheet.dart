import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/settings.dart';
import '../core/strings.dart';
import 'common.dart';

/// Creates a price tracker for a search, an "anywhere" query or a meetup. The id is remembered on
/// this device so the Tracking tab can show it.
Future<void> showTrackSheet(BuildContext context, {required String defaultLabel, required Json params, double? currentPrice}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _TrackSheet(defaultLabel: defaultLabel, params: params, currentPrice: currentPrice),
  );
}

class _TrackSheet extends ConsumerStatefulWidget {
  const _TrackSheet({required this.defaultLabel, required this.params, this.currentPrice});
  final String defaultLabel;
  final Json params;
  final double? currentPrice;

  @override
  ConsumerState<_TrackSheet> createState() => _TrackSheetState();
}

class _TrackSheetState extends ConsumerState<_TrackSheet> {
  late final TextEditingController _label = TextEditingController(text: widget.defaultLabel);
  late final TextEditingController _target = TextEditingController(text: widget.currentPrice == null ? '' : '${(widget.currentPrice! * 0.85).round()}');
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _label.dispose();
    _target.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final s = ref.read(stringsProvider);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final target = double.tryParse(_target.text.replaceAll(',', '.'));
      final w = await ref.read(apiProvider).createWatch({
        'label': _label.text.trim(),
        'params': widget.params,
        if (target != null && target > 0) 'targetPrice': target,
        'dropThreshold': 0.05,
      });
      ref.read(myWatchIdsProvider.notifier).add(w.id);
      if (!mounted) return;
      final messenger = ScaffoldMessenger.of(context);
      Navigator.of(context).pop();
      messenger.showSnackBar(SnackBar(content: Text(s('created'))));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e, s));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, 20 + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(s('track'), style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 4),
        Text(s('watchHint'), style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
        const SizedBox(height: 12),
        FieldLabel(s('watchLabel')),
        TextField(controller: _label, textInputAction: TextInputAction.next),
        FieldLabel('${s('targetPrice')} (EUR)'),
        TextField(controller: _target, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(hintText: '—')),
        if (_error != null) ErrorBox(message: _error!),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton(onPressed: _busy || _label.text.trim().isEmpty ? null : _save, child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.4)) : Text(s('save'))),
        ),
      ]),
    );
  }
}
