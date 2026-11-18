import 'package:flutter/material.dart';

/// Extra colours the Material scheme has no slot for.
@immutable
class RemeetColors extends ThemeExtension<RemeetColors> {
  const RemeetColors({required this.text2, required this.text3, required this.border, required this.borderStrong, required this.surface2, required this.accentText, required this.soft, required this.good, required this.warn, required this.crit, required this.series, required this.e});
  final Color text2;
  final Color text3;
  final Color border;
  final Color borderStrong;
  final Color surface2;

  /// Readable accent for text and icons (the plain accent is yellow, which is too light for text).
  final Color accentText;
  final Color soft;
  final Color good;
  final Color warn;
  final Color crit;

  /// Colours for people, bars and chart lines.
  final List<Color> series;

  /// The three colours of the wordmark's "eee".
  final List<Color> e;

  @override
  RemeetColors copyWith() => this;

  @override
  RemeetColors lerp(ThemeExtension<RemeetColors>? other, double t) {
    if (other is! RemeetColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return RemeetColors(
      text2: l(text2, other.text2),
      text3: l(text3, other.text3),
      border: l(border, other.border),
      borderStrong: l(borderStrong, other.borderStrong),
      surface2: l(surface2, other.surface2),
      accentText: l(accentText, other.accentText),
      soft: l(soft, other.soft),
      good: l(good, other.good),
      warn: l(warn, other.warn),
      crit: l(crit, other.crit),
      series: [for (var i = 0; i < series.length; i++) l(series[i], other.series[i])],
      e: [for (var i = 0; i < e.length; i++) l(e[i], other.e[i])],
    );
  }
}

extension RemeetColorsContext on BuildContext {
  RemeetColors get rc => Theme.of(this).extension<RemeetColors>()!;
}

// ignore: avoid_classes_with_only_static_members
class AppTheme {
  /// The "Sun" palette: slate neutrals with a sunny yellow accent (dark ink on yellow fills).
  static const _light = RemeetColors(
    text2: Color(0xFF475569),
    text3: Color(0xFF627288),
    border: Color(0xFFDCE0E8),
    borderStrong: Color(0xFFBFC6D3),
    surface2: Color(0xFFE9ECF1),
    accentText: Color(0xFF8A5A00),
    soft: Color(0xFFFEF3C7),
    good: Color(0xFF15803D),
    warn: Color(0xFFB45309),
    crit: Color(0xFFC0392B),
    series: [Color(0xFF3B5BDB), Color(0xFFF59E0B), Color(0xFF0B7A70), Color(0xFF9333EA), Color(0xFFDB2777), Color(0xFF64748B)],
    e: [Color(0xFFF5B50A), Color(0xFF3B5BDB), Color(0xFF0D9488)],
  );

  static const _dark = RemeetColors(
    text2: Color(0xFFC3CCDA),
    text3: Color(0xFF8D9AB3),
    border: Color(0xFF2A3857),
    borderStrong: Color(0xFF3B4C74),
    surface2: Color(0xFF1E2A44),
    accentText: Color(0xFFFDE047),
    soft: Color(0xFF3A3210),
    good: Color(0xFF4ADE80),
    warn: Color(0xFFFBBF24),
    crit: Color(0xFFF87171),
    series: [Color(0xFFFACC15), Color(0xFF60A5FA), Color(0xFF2DD4BF), Color(0xFFC084FC), Color(0xFFF472B6), Color(0xFF94A3B8)],
    e: [Color(0xFFF5B50A), Color(0xFF60A5FA), Color(0xFF2DD4BF)],
  );

  static ThemeData light() => _build(
        brightness: Brightness.light,
        x: _light,
        bg: const Color(0xFFF5F6F8),
        surface: Colors.white,
        text: const Color(0xFF1E293B),
        accent: const Color(0xFFFACC15),
        ink: const Color(0xFF1E293B),
        secondary: const Color(0xFF3B5BDB),
      );

  static ThemeData dark() => _build(
        brightness: Brightness.dark,
        x: _dark,
        bg: const Color(0xFF0F172A),
        surface: const Color(0xFF172033),
        text: const Color(0xFFF1F5F9),
        accent: const Color(0xFFFACC15),
        ink: const Color(0xFF0F172A),
        secondary: const Color(0xFF60A5FA),
      );

  static ThemeData _build({required Brightness brightness, required RemeetColors x, required Color bg, required Color surface, required Color text, required Color accent, required Color ink, required Color secondary}) {
    final scheme = ColorScheme(
      brightness: brightness,
      primary: accent,
      onPrimary: ink,
      secondary: secondary,
      onSecondary: brightness == Brightness.light ? Colors.white : ink,
      error: x.crit,
      onError: brightness == Brightness.light ? Colors.white : ink,
      surface: surface,
      onSurface: text,
      onSurfaceVariant: x.text2,
      outline: x.borderStrong,
      outlineVariant: x.border,
      surfaceContainerHighest: x.surface2,
      surfaceContainerHigh: x.surface2,
      surfaceContainer: surface,
      surfaceContainerLow: surface,
      primaryContainer: x.soft,
      onPrimaryContainer: x.accentText,
    );
    final radius = BorderRadius.circular(14);
    OutlineInputBorder border(Color c, [double w = 1]) => OutlineInputBorder(borderRadius: radius, borderSide: BorderSide(color: c, width: w));
    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: bg,
      extensions: [x],
      appBarTheme: AppBarTheme(backgroundColor: bg, foregroundColor: text, elevation: 0, scrolledUnderElevation: 0, centerTitle: false),
      cardTheme: CardThemeData(color: surface, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18), side: BorderSide(color: x.border))),
      dividerTheme: DividerThemeData(color: x.border, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: border(x.border),
        enabledBorder: border(x.border),
        focusedBorder: border(x.accentText, 1.6),
        hintStyle: TextStyle(color: x.text3),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(backgroundColor: accent, foregroundColor: ink, minimumSize: const Size(0, 50), shape: RoundedRectangleBorder(borderRadius: radius), textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(foregroundColor: text, minimumSize: const Size(0, 46), side: BorderSide(color: x.borderStrong), shape: RoundedRectangleBorder(borderRadius: radius), textStyle: const TextStyle(fontWeight: FontWeight.w700)),
      ),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: x.accentText, textStyle: const TextStyle(fontWeight: FontWeight.w700))),
      chipTheme: ChipThemeData(
        backgroundColor: surface,
        selectedColor: x.soft,
        side: BorderSide(color: x.border),
        labelStyle: TextStyle(color: x.text2, fontWeight: FontWeight.w600, fontSize: 13),
        secondaryLabelStyle: TextStyle(color: x.accentText, fontWeight: FontWeight.w700, fontSize: 13),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99)),
        showCheckmark: false,
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          backgroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? x.soft : surface),
          foregroundColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? x.accentText : x.text2),
          side: WidgetStatePropertyAll(BorderSide(color: x.border)),
          textStyle: const WidgetStatePropertyAll(TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: x.soft,
        surfaceTintColor: Colors.transparent,
        labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: s.contains(WidgetState.selected) ? x.accentText : x.text3)),
        iconTheme: WidgetStateProperty.resolveWith((s) => IconThemeData(color: s.contains(WidgetState.selected) ? x.accentText : x.text3)),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? x.accentText : x.borderStrong),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
      sliderTheme: SliderThemeData(activeTrackColor: x.accentText, thumbColor: x.accentText, inactiveTrackColor: x.border),
      snackBarTheme: SnackBarThemeData(behavior: SnackBarBehavior.floating, backgroundColor: text, contentTextStyle: TextStyle(color: bg, fontWeight: FontWeight.w600), shape: RoundedRectangleBorder(borderRadius: radius)),
      bottomSheetTheme: BottomSheetThemeData(backgroundColor: surface, showDragHandle: true, shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24)))),
      textTheme: (brightness == Brightness.light ? Typography.material2021().black : Typography.material2021().white).apply(bodyColor: text, displayColor: text),
    );
  }
}
