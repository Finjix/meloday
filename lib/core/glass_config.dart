import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

/// Centralised liquid-glass presets for Meloday — light mode only.
abstract final class GlassConfig {
  GlassConfig._();

  /// Apple-standard upper-left light source.
  static const double lightAngle = 0.75 * math.pi;

  /// Unified light-mode glass settings (based on the bottom nav bar).
  static const LiquidGlassSettings light = LiquidGlassSettings(
    blur: 3,
    thickness: 1,
    lightIntensity: 3.0,
    lightAngle: lightAngle,
    glassColor: Color.fromARGB(0, 255, 255, 255),
    refractiveIndex: 1,
    ambientStrength: 0.1,
    saturation: 1.0,
    glowIntensity: 1.0,
    chromaticAberration: 0.01,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1,
  );

  // ── Semantic aliases ────────────────────────────────────────────────

  static const LiquidGlassSettings navBar = light;
  static const LiquidGlassSettings surface = light;
  static const LiquidGlassSettings card = light;
  static const LiquidGlassSettings sheet = light;
  static const LiquidGlassSettings input = light;
  static const LiquidGlassSettings interactive = light;
  static const LiquidGlassSettings tag = light;

  /// Opaque white rim used on interactive oval buttons.
  static const Color buttonRimWhite = Color(0x55FFFFFF);
}
