import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/config.dart';
import '../../core/settings.dart';
import '../../core/strings.dart';
import '../../ui/common.dart';
import '../../ui/links.dart';

class MoreScreen extends ConsumerWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final rc = context.rc;
    final settings = ref.watch(settingsProvider);
    final notifier = ref.read(settingsProvider.notifier);
    Widget link(String label, String path) => ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          trailing: const Icon(Icons.open_in_new, size: 18),
          onTap: () => openLink(context, '$webBaseUrl$path'),
        );
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          ScreenHeader(title: s('settings')),
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              FieldLabel(s('language')),
              SegmentedButton<String>(
                showSelectedIcon: false,
                segments: const [ButtonSegment(value: 'uk', label: Text('Українська')), ButtonSegment(value: 'en', label: Text('English'))],
                selected: {settings.lang},
                onSelectionChanged: (v) => notifier.setLang(v.first),
              ),
              const SizedBox(height: 16),
              FieldLabel(s('theme')),
              SegmentedButton<ThemeMode>(
                showSelectedIcon: false,
                segments: [ButtonSegment(value: ThemeMode.system, label: Text(s('themeSystem'))), ButtonSegment(value: ThemeMode.light, label: Text(s('themeLight'))), ButtonSegment(value: ThemeMode.dark, label: Text(s('themeDark')))],
                selected: {settings.themeMode},
                onSelectionChanged: (v) => notifier.setThemeMode(v.first),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          Panel(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Column(children: [link(s('privacy'), '/privacy'), Divider(color: rc.border), link(s('terms'), '/terms')]),
          ),
          const SizedBox(height: 12),
          Panel(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              FieldLabel(s('about')),
              Text('Re:meeet · ${s('version')} $appVersion', style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text('${s('server')}: $apiBaseUrl', style: TextStyle(color: rc.text3, fontSize: 12)),
              const SizedBox(height: 12),
              Text(s('slogan'), style: TextStyle(color: rc.text2)),
              const SizedBox(height: 12),
              Text(s('rights'), style: TextStyle(color: rc.text3, fontSize: 12)),
            ]),
          ),
        ],
      ),
    );
  }
}
