
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Overridden in `main` with the loaded instance, so reads are synchronous.
final sharedPrefsProvider = Provider<SharedPreferences>((ref) => throw UnimplementedError('sharedPrefsProvider must be overridden'));

class AppSettings {
  const AppSettings({required this.lang, required this.themeMode});
  final String lang; // 'uk' | 'en'
  final ThemeMode themeMode;

  AppSettings copyWith({String? lang, ThemeMode? themeMode}) => AppSettings(lang: lang ?? this.lang, themeMode: themeMode ?? this.themeMode);
}

class SettingsNotifier extends Notifier<AppSettings> {
  static const _langKey = 'lang';
  static const _themeKey = 'theme';

  @override
  AppSettings build() {
    final p = ref.read(sharedPrefsProvider);
    final saved = p.getString(_langKey);
    return AppSettings(
      lang: saved == 'en' || saved == 'uk' ? saved! : 'uk',
      themeMode: switch (p.getString(_themeKey)) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      },
    );
  }

  void setLang(String lang) {
    ref.read(sharedPrefsProvider).setString(_langKey, lang);
    state = state.copyWith(lang: lang);
  }

  void setThemeMode(ThemeMode mode) {
    ref.read(sharedPrefsProvider).setString(_themeKey, mode.name);
    state = state.copyWith(themeMode: mode);
  }
}

final settingsProvider = NotifierProvider<SettingsNotifier, AppSettings>(SettingsNotifier.new);
