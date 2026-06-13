import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

/// Centralised liquid-glass presets for Meloday.
///
/// All presets are unified around a single base setting from the light-mode
/// bottom navigation bar, ensuring a consistent glass look across every
/// surface. Light and dark modes differ only in the [glassColor] tint.
abstract final class GlassConfig {
  GlassConfig._();

  /// Apple-standard upper-left light source, shared by all surfaces.
  static const double lightAngle = 0.75 * math.pi;

  /// Cool-white glass tint for light mode (~13 % alpha).
  static const Color coolWhite = Color(0x21F4F8FA);

  /// Semi-transparent white for dark-mode glass (~20 % alpha).
  static const Color darkGlass = Color(0x33FFFFFF);

  // ── Reference presets ───────────────────────────────────────────────

  /// Unified light-mode glass settings (based on the bottom nav bar).
  static const LiquidGlassSettings light = LiquidGlassSettings(
    blur: 12,
    thickness: 45,
    lightIntensity: 2.0,
    lightAngle: lightAngle,
    glassColor: coolWhite,
    refractiveIndex: 1.8,
    ambientStrength: 0.08,
    saturation: 1.5,
    glowIntensity: 1.0,
    chromaticAberration: 0.05,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 0.8,
  );

  /// Unified dark-mode glass settings.
  static const LiquidGlassSettings dark = LiquidGlassSettings(
    blur: 12,
    thickness: 45,
    lightIntensity: 2.0,
    lightAngle: lightAngle,
    glassColor: darkGlass,
    refractiveIndex: 1.8,
    ambientStrength: 0.08,
    saturation: 1.5,
    glowIntensity: 1.0,
    chromaticAberration: 0.05,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 0.8,
  );

  // ── Semantic aliases (light) ────────────────────────────────────────

  static const LiquidGlassSettings navBar = light;
  static const LiquidGlassSettings surface = light;
  static const LiquidGlassSettings card = light;
  static const LiquidGlassSettings sheet = light;
  static const LiquidGlassSettings input = light;
  static const LiquidGlassSettings interactive = light;
  static const LiquidGlassSettings tag = light;

  // ── Semantic aliases (dark) ─────────────────────────────────────────

  static const LiquidGlassSettings darkNavBar = dark;
  static const LiquidGlassSettings darkSurface = dark;
  static const LiquidGlassSettings darkCard = dark;
  static const LiquidGlassSettings darkSheet = dark;
  static const LiquidGlassSettings darkInput = dark;
  static const LiquidGlassSettings darkInteractive = dark;
  static const LiquidGlassSettings darkTag = dark;

  /// Opaque white rim used on interactive oval buttons (play/pause etc.).
  static const Color buttonRimWhite = Color(0x55FFFFFF);
}
