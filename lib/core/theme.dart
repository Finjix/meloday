import 'package:flutter/material.dart';

class AppTheme {
  static const String defaultAccentHex = '#E88DAA';
  static const Color defaultAccent = Color(0xFFE88DAA);

  /// Default font family — a warm handwritten KaiTi style.
  static const String defaultFontFamily = 'LXGW WenKai';

  /// Font family for diary content — cute, rounded handwriting.
  static const String diaryFontFamily = 'ZCOOL KuaiLe';

  static const Color surfaceLightMedium = Color(0xFFEDE4F0);

  static const Color accent = Color(0xFFE88DAA);

  /// Derive a very light tint for the scaffold background.
  static Color scaffoldBgFromAccent(Color accent) {
    return Color.lerp(accent, Colors.white, 0.85)!;
  }

  static Color moodColorFromHex(String hex) {
    final color = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
    if (color == null) return accent;
    return Color(color | 0xFF000000);
  }

  /// Returns a two-color gradient pair derived from [color].
  static List<Color> gradientPairFromMood(Color color) {
    final hsl = HSLColor.fromColor(color);
    return [
      hsl.withLightness(0.55).withSaturation(0.8).toColor(),
      hsl.withLightness(0.35).withSaturation(0.6).toColor(),
    ];
  }

  /// Build a light [ThemeData] from [accentHex].
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
        onSurface: const Color(0xFF3C3C3C),
        onSurfaceVariant: const Color(0xFF6B6B6B),
      ),
      fontFamily: defaultFontFamily,
    );
  }
}
