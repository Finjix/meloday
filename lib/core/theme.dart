import 'package:flutter/material.dart';

class AppTheme {
  // Light theme palette
  static const Color surfaceLightBg = Color(0xFFF5F0F7);
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

  static const Color accent = Color(0xFFE88DAA);

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

  static ThemeData get lightTheme => ThemeData(
    brightness: Brightness.light,
    scaffoldBackgroundColor: surfaceLightBg,
    colorScheme: const ColorScheme.light(
      primary: accent,
      secondary: Color(0xFF8B6BA0),
      surface: surfaceLightMedium,
    ),
    fontFamily: 'Roboto',
  );

  static ThemeData get darkTheme => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: surfaceDark,
    colorScheme: const ColorScheme.dark(
      primary: accent,
      secondary: surfaceLight,
      surface: surfaceMedium,
    ),
    fontFamily: 'Roboto',
  );
}
