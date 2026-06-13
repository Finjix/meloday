import 'package:flutter/material.dart';

class AppTheme {
  static const String defaultAccentHex = '#E88DAA';
  static const Color defaultAccent = Color(0xFFE88DAA);

  // Light theme palette — scaffold background is now derived from accent
  static const Color surfaceLightMedium = Color(0xFFEDE4F0);
  static const Color surfaceLightAccent = Color(0xFFE0D4E8);
  static const Color textLightPrimary = Color(0xFF2D1B3E);
  static const Color textLightSecondary = Color(0xFF7A6B8A);

  // Dark theme palette (legacy)
  static const Color surfaceDark = Color(0xFF1A1A2E);
  static const Color surfaceMedium = Color(0xFF16213E);
  static const Color surfaceLight = Color(0xFF0F3460);
  static const Color textPrimary = Color(0xFFE8E8E8);
  static const Color textSecondary = Color(0xFFA0A0B0);

  /// Legacy const accent (for fallback / backward compat).
  static const Color accent = Color(0xFFE88DAA);

  /// Derive a very light tint (≈15% accent + 85% white) for the scaffold
  /// background so it subtly echoes the current theme colour.
  static Color scaffoldBgFromAccent(Color accent) {
    return Color.lerp(accent, Colors.white, 0.85)!;
  }

  static Color darkScaffoldBgFromAccent(Color accent) {
    return Color.lerp(accent, surfaceDark, 0.90)!;
  }

  static Color moodColorFromHex(String hex) {
    final color = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
    if (color == null) return accent;
    return Color(color | 0xFF000000);
  }

  /// Returns a two-color gradient pair derived from [color] for use in
  /// cover images and thumbnails. First color is lighter, second is darker.
  static List<Color> gradientPairFromMood(Color color) {
    final hsl = HSLColor.fromColor(color);
    return [
      hsl.withLightness(0.55).withSaturation(0.8).toColor(),
      hsl.withLightness(0.35).withSaturation(0.6).toColor(),
    ];
  }

  /// Build a light [ThemeData] whose primary colour and scaffold background
  /// are derived from [accentHex] (a hex string like `'#E88DAA'`).
  static ThemeData lightThemeFromHex(String accentHex) {
    return lightThemeFromColor(moodColorFromHex(accentHex));
  }

  static ThemeData lightThemeFromColor(Color accentColor) {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: scaffoldBgFromAccent(accentColor),
      colorScheme: ColorScheme.light(
        primary: accentColor,
        secondary: const Color(0xFF8B6BA0),
        surface: surfaceLightMedium,
      ),
      fontFamily: 'Roboto',
    );
  }

  static ThemeData darkThemeFromHex(String accentHex) {
    return darkThemeFromColor(moodColorFromHex(accentHex));
  }

  static ThemeData darkThemeFromColor(Color accentColor) {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: darkScaffoldBgFromAccent(accentColor),
      colorScheme: ColorScheme.dark(
        primary: accentColor,
        secondary: surfaceLight,
        surface: surfaceMedium,
      ),
      fontFamily: 'Roboto',
    );
  }

  static ThemeData get lightTheme => lightThemeFromColor(accent);
  static ThemeData get darkTheme => darkThemeFromColor(accent);
}
