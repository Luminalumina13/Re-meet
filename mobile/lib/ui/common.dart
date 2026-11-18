import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/theme.dart';
import '../core/api.dart';
import '../core/strings.dart';

/// Screen title block: slogan-style eyebrow, headline and a muted line.
class ScreenHeader extends StatelessWidget {
  const ScreenHeader({super.key, required this.title, this.subtitle, this.eyebrow});
  final String title;
  final String? subtitle;
  final String? eyebrow;

  @override
  Widget build(BuildContext context) {
    final rc = context.rc;
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (eyebrow != null) Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(eyebrow!, style: t.labelLarge?.copyWith(color: rc.accentText, fontWeight: FontWeight.w800))),
        Text(title, style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800, height: 1.15)),
        if (subtitle != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(subtitle!, style: t.bodyMedium?.copyWith(color: rc.text2, height: 1.35))),
      ]),
    );
  }
}

/// A rounded card with comfortable padding.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.highlight = false});
  final Widget child;
  final EdgeInsets padding;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: highlight ? scheme.primary : context.rc.border, width: highlight ? 1.6 : 1)),
      child: Padding(padding: padding, child: child),
    );
  }
}

class FieldLabel extends StatelessWidget {
  const FieldLabel(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6, top: 4),
        child: Text(text.toUpperCase(), style: Theme.of(context).textTheme.labelSmall?.copyWith(color: context.rc.text3, fontWeight: FontWeight.w800, letterSpacing: 0.6)),
      );
}

/// Small rounded label (badges, statuses).
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.color, this.background, this.icon});
  final String text;
  final Color? color;
  final Color? background;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final rc = context.rc;
    final fg = color ?? rc.accentText;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: background ?? rc.soft, borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) Padding(padding: const EdgeInsets.only(right: 4), child: Icon(icon, size: 13, color: fg)),
        Text(text, style: TextStyle(color: fg, fontSize: 11.5, fontWeight: FontWeight.w800)),
      ]),
    );
  }
}

/// Server validation messages (stable English texts) to localized strings.
const _fieldMessages = {
  'Each infant needs an adult': 'errInfants',
  'At most 9 passengers': 'errPassengers',
  'Origin and destination must differ': 'errSameRoute',
  'Return before departure': 'errReturnDate',
};

String errorText(Object e, Strings s) {
  if (e is! ApiException) return s('errServer');
  switch (e.message) {
    case 'offline':
      return s('errOffline');
    case 'timeout':
      return s('errTimeout');
    case 'invalid_request':
      for (final m in e.issues) {
        final key = _fieldMessages[m];
        if (key != null) return s(key);
      }
      return s('errInvalid');
    case 'bad_json':
      return s('errBadJson');
    case 'not_found':
      return s('errNotFound');
    case 'unauthorized':
      return s('errUnauthorized');
    case 'unavailable':
      return s('errUnavailable');
    default:
      return s('errServer');
  }
}

class ErrorBox extends StatelessWidget {
  const ErrorBox({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final rc = context.rc;
    return Consumer(builder: (context, ref, _) {
      final s = ref.watch(stringsProvider);
      return Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: rc.crit.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14), border: Border.all(color: rc.crit.withValues(alpha: 0.4))),
        child: Row(children: [
          Icon(Icons.error_outline, color: rc.crit),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: TextStyle(color: rc.crit, fontWeight: FontWeight.w600))),
          if (onRetry != null) TextButton(onPressed: onRetry, child: Text(s('retry'))),
        ]),
      );
    });
  }
}

/// Primary submit button that keeps its width while its label changes ("Search" → "Searching…"): both
/// labels share one cell, so the longer one sets the size and nothing around it jumps.
class SubmitButton extends StatelessWidget {
  const SubmitButton({super.key, required this.icon, required this.idle, required this.busy, required this.loading, required this.onPressed});
  final IconData icon;
  final String idle;
  final String busy;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    // Both labels are laid out (so the longer one sets the width) but only one is painted. The spinner
    // exists only while loading: a hidden spinner would keep animating and waste battery.
    Widget layer(Widget lead, String text, bool visible) => ExcludeSemantics(
          excluding: !visible,
          child: Opacity(opacity: visible ? 1 : 0, child: Row(mainAxisSize: MainAxisSize.min, children: [lead, const SizedBox(width: 8), Text(text)])),
        );
    return FilledButton(
      onPressed: loading ? null : onPressed,
      child: Stack(alignment: Alignment.center, children: [
        layer(Icon(icon, size: 18), idle, !loading),
        layer(SizedBox(width: 18, height: 18, child: loading ? const CircularProgressIndicator(strokeWidth: 2.4) : null), busy, loading),
      ]),
    );
  }
}

/// Opens a link in the browser or the airline's app.
class LoadingNote extends StatelessWidget {
  const LoadingNote(this.text, {super.key});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(children: [
          const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3)),
          const SizedBox(height: 12),
          Text(text, textAlign: TextAlign.center, style: TextStyle(color: context.rc.text3)),
        ]),
      );
}
