import 'package:flutter/material.dart';

class AppTheme {
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
