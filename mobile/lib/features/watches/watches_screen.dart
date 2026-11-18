import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/api.dart';
import '../../core/format.dart';
import '../../core/models.dart';
import '../../core/settings.dart';
import '../../core/strings.dart';
import '../../ui/common.dart';
import '../../ui/links.dart';

/// Trackers created on this device (the backend has no accounts yet, so it cannot list "mine").
final watchesProvider = FutureProvider.autoDispose<List<Watch>>((ref) async {
  final ids = ref.watch(myWatchIdsProvider);
  if (ids.isEmpty) return const [];
  final api = ref.watch(apiProvider);
  final results = await Future.wait(ids.map((id) async {
    try {
      return await api.getWatch(id);
    } on ApiException catch (e) {
      return e;
    }
  }));
  // Every request failed (offline, server down): surface the error instead of an empty list.
  if (results.every((r) => r is ApiException)) throw results.first! as ApiException;
  return results.whereType<Watch>().toList();
});

class WatchesScreen extends ConsumerStatefulWidget {
  const WatchesScreen({super.key});

  @override
  ConsumerState<WatchesScreen> createState() => _WatchesScreenState();
}

class _WatchesScreenState extends ConsumerState<WatchesScreen> with WidgetsBindingObserver {
  String? _busy;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Coming back from Telegram: pick up that the chat got connected.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ref.invalidate(watchesProvider);
  }

  Future<void> _act(String id, Future<void> Function(RemeetApi api) fn) async {
    final s = ref.read(stringsProvider);
    setState(() => _busy = id);
    try {
      await fn(ref.read(apiProvider));
      ref.invalidate(watchesProvider);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorText(e, s))));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  Future<void> _delete(Watch w) async {
    final s = ref.read(stringsProvider);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        content: Text(s('deleteAsk', {'label': w.label})),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(s('cancel'))), TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(s('delete')))],
      ),
    );
    if (ok != true) return;
    await _act(w.id, (api) async {
      await api.deleteWatch(w.id);
      ref.read(myWatchIdsProvider.notifier).remove(w.id);
    });
  }

  Future<void> _connectTelegram(Watch w) async {
    final s = ref.read(stringsProvider);
    setState(() => _busy = w.id);
    try {
      final url = await ref.read(apiProvider).telegramLink(w.id);
      if (mounted) await openLink(context, url.toString());
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(errorText(e, s))));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final watches = ref.watch(watchesProvider);
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(watchesProvider);
          await ref.read(watchesProvider.future).catchError((_) => <Watch>[]);
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            ScreenHeader(title: s('watchesTitle'), subtitle: s('watchesSub')),
            watches.when(
              loading: () => LoadingNote(s('searching')),
              error: (e, _) => ErrorBox(message: errorText(e, s), onRetry: () => ref.invalidate(watchesProvider)),
              data: (list) => list.isEmpty
                  ? Panel(child: Column(children: [Icon(Icons.notifications_none, size: 34, color: rc.text3), const SizedBox(height: 10), Text(s('watchesEmpty'), textAlign: TextAlign.center, style: TextStyle(color: rc.text2))]))
                  : Column(children: [for (final w in list) Padding(padding: const EdgeInsets.only(bottom: 12), child: _WatchCard(w: w, busy: _busy == w.id, onCheck: () => _act(w.id, (api) => api.checkWatch(w.id).then((_) {})), onToggle: () => _act(w.id, (api) => api.patchWatch(w.id, {'active': !w.active}).then((_) {})), onDelete: () => _delete(w), onTelegram: () => _connectTelegram(w)))]),
            ),
          ],
        ),
      ),
    );
  }
}

class _WatchCard extends ConsumerWidget {
  const _WatchCard({required this.w, required this.busy, required this.onCheck, required this.onToggle, required this.onDelete, required this.onTelegram});
  final Watch w;
  final bool busy;
  final VoidCallback onCheck;
  final VoidCallback onToggle;
  final VoidCallback onDelete;
  final VoidCallback onTelegram;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final delta = w.lastDelta;
    final kind = switch (w.kind) { 'meetup' => s('kindMeetup'), 'explore' => s('kindExplore'), _ => s('kindSearch') };
    final alerts = w.alerts.reversed.take(3).toList();
    return Panel(
      child: Opacity(
        opacity: w.active ? 1 : 0.7,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Wrap(spacing: 6, children: [Pill(kind), if (!w.active) Pill(s('paused'), color: rc.warn, background: rc.warn.withValues(alpha: 0.14))]),
                const SizedBox(height: 6),
                Text(w.label, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(w.lastBestPrice == null ? '—' : money(w.lastBestPrice!, w.currency, s), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
              if (delta != 0) Text('${delta > 0 ? '+' : ''}${money(delta, w.currency, s)}', style: TextStyle(color: delta < 0 ? rc.good : rc.crit, fontSize: 12, fontWeight: FontWeight.w700)),
              if (w.targetPrice != null) Text('🎯 ${money(w.targetPrice!, w.currency, s)}', style: TextStyle(color: rc.text3, fontSize: 12)),
            ]),
          ]),
          if (w.history.length >= 2) Padding(padding: const EdgeInsets.only(top: 12), child: SizedBox(height: 44, width: double.infinity, child: CustomPaint(painter: _SparklinePainter(w.history.map((p) => p.bestPrice).toList(), rc.accentText)))),
          const SizedBox(height: 10),
          if (alerts.isEmpty) Text(s('noEvents'), style: TextStyle(color: rc.text3, fontSize: 13)) else for (final a in alerts) Padding(padding: const EdgeInsets.only(bottom: 4), child: Text('• ${a.message}', maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: rc.text2, fontSize: 13))),
          const SizedBox(height: 6),
          Text('${s('lastChecked')}: ${w.lastCheckedAt == null ? s('never') : '${shortDate(w.lastCheckedAt!, s)} ${clock(w.lastCheckedAt!.replaceFirst('T', 'T'))}'}', style: TextStyle(color: rc.text3, fontSize: 12)),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 4, children: [
            OutlinedButton.icon(onPressed: busy ? null : onCheck, icon: busy ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.refresh, size: 18), label: Text(s('checkNow'))),
            OutlinedButton.icon(onPressed: busy ? null : onToggle, icon: Icon(w.active ? Icons.pause : Icons.play_arrow, size: 18), label: Text(w.active ? s('pause') : s('resume'))),
            if (w.telegramConnected) Pill(s('telegramConnected'), icon: Icons.check, color: rc.good, background: rc.good.withValues(alpha: 0.14)) else OutlinedButton.icon(onPressed: busy ? null : onTelegram, icon: const Icon(Icons.send, size: 16), label: Text(s('connectTelegram'))),
            IconButton(tooltip: s('delete'), onPressed: busy ? null : onDelete, icon: Icon(Icons.delete_outline, color: rc.crit)),
          ]),
        ]),
      ),
    );
  }
}

class _SparklinePainter extends CustomPainter {
  _SparklinePainter(this.values, this.color);
  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (values.length < 2) return;
    final lo = values.reduce((a, b) => a < b ? a : b);
    final hi = values.reduce((a, b) => a > b ? a : b);
    final range = (hi - lo) == 0 ? 1 : hi - lo;
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height - 4 - (size.height - 8) * ((values[i] - lo) / range);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(path, Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 2.2..strokeJoin = StrokeJoin.round);
  }

  @override
  bool shouldRepaint(_SparklinePainter old) => old.values != values || old.color != color;
}
