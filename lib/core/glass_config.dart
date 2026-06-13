import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

/// Centralised liquid-glass presets for Meloday.
///
/// Tuned for **晶莹剔透** — the glass body uses a slightly **cool-white**
/// tint that contrasts against the warm-pink scaffold background, making
/// the glass layer immediately perceptible even on a near-uniform backdrop.
///
/// Design rationale:
///
///   • Background is `#FCEEF2` (very light warm pink).
///   • Glass uses a neutral-to-cool white tint (`#F4F8FA` at ~10–15 %
///     opacity). The slight temperature shift creates a visible "glass
///     veil" that blur alone cannot achieve on a solid colour.
///   • Blur (10–16 px) adds frosting haze that further separates the
///     glass plane from the background plane.
///   • Thickness (40–55) + lightIntensity (2.0–3.0) produce a wide,
///     brilliant specular rim.
///   • glowIntensity ≥ 1.0 gives the Fresnel edge glow — the hallmark of
///     glassy sheen.
///   • chromaticAberration (0.04–0.08) adds rainbow fringing on edges.
abstract final class GlassConfig {
  GlassConfig._();

  /// Apple-standard upper-left light source, shared by all surfaces.
  static const double lightAngle = 0.75 * math.pi;

  /// Cool-white glass tint that contrasts with the warm-pink background.
  /// `0x21` = 13 % alpha, `F4F8FA` = very pale cool white.
  static const Color coolWhite = Color(0x21F4F8FA);

  /// Slightly stronger cool-white for interactive elements.
  static const Color coolWhiteStrong = Color(0x2BF4F8FA);

  /// Semi-transparent white for dark-mode glass.
  static const Color darkGlass = Color(0x2DFFFFFF); // ~18% white

  /// Slightly stronger white for dark-mode interactive elements.
  static const Color darkGlassStrong = Color(0x38FFFFFF); // ~22% white

  // ── Presets ─────────────────────────────────────────────────────────

  /// Bottom navigation bar.
  static const LiquidGlassSettings navBar = LiquidGlassSettings(
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
    shadowElevation: 2.0,
  );

  /// Large panels (cover area, hero) — maximum drama.
  static const LiquidGlassSettings surface = LiquidGlassSettings(
    blur: 10,
    thickness: 55,
    lightIntensity: 3.0,
    lightAngle: lightAngle,
    glassColor: Color(0x1EF4F8FA), // ~12 % cool white
    refractiveIndex: 2.0,
    ambientStrength: 0.10,
    saturation: 1.6,
    glowIntensity: 1.5,
    chromaticAberration: 0.08,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 4.0,
  );

  /// Standard cards — the workhorse.
  static const LiquidGlassSettings card = LiquidGlassSettings(
    blur: 12,
    thickness: 45,
    lightIntensity: 2.5,
    lightAngle: lightAngle,
    glassColor: coolWhite,
    refractiveIndex: 1.8,
    ambientStrength: 0.08,
    saturation: 1.5,
    glowIntensity: 1.2,
    chromaticAberration: 0.06,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 3.0,
  );

  /// Modal bottom sheet.
  static const LiquidGlassSettings sheet = LiquidGlassSettings(
    blur: 16,
    thickness: 45,
    lightIntensity: 2.0,
    lightAngle: lightAngle,
    glassColor: Color(0x28F4F8FA), // ~16 % cool white
    refractiveIndex: 1.6,
    ambientStrength: 0.10,
    saturation: 1.5,
    glowIntensity: 0.9,
    chromaticAberration: 0.04,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 3.0,
  );

  /// Chat input — matches the glassy look while keeping text readable.
  static const LiquidGlassSettings input = LiquidGlassSettings(
    blur: 12,
    thickness: 40,
    lightIntensity: 2.0,
    lightAngle: lightAngle,
    glassColor: Color(0x28F4F8FA), // ~16 % cool white
    refractiveIndex: 1.6,
    ambientStrength: 0.10,
    saturation: 1.5,
    glowIntensity: 0.9,
    chromaticAberration: 0.04,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 2.0,
  );

  /// Interactive elements (buttons, avatars) — denser tint = distinct object.
  static const LiquidGlassSettings interactive = LiquidGlassSettings(
    blur: 12,
    thickness: 40,
    lightIntensity: 2.5,
    lightAngle: lightAngle,
    glassColor: coolWhiteStrong,
    refractiveIndex: 1.8,
    ambientStrength: 0.12,
    saturation: 1.5,
    glowIntensity: 1.2,
    chromaticAberration: 0.05,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 2.5,
  );

  /// Opaque white rim used on interactive oval buttons (play/pause etc.).
  static const Color buttonRimWhite = Color(0x55FFFFFF);

  /// Small tags / chips.
  static const LiquidGlassSettings tag = LiquidGlassSettings(
    blur: 10,
    thickness: 35,
    lightIntensity: 1.8,
    lightAngle: lightAngle,
    glassColor: coolWhite,
    refractiveIndex: 1.6,
    ambientStrength: 0.08,
    saturation: 1.4,
    glowIntensity: 0.8,
    chromaticAberration: 0.04,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1.5,
  );

  // ── Dark-mode presets ────────────────────────────────────────────────

  /// Dark bottom navigation bar.
  static const LiquidGlassSettings darkNavBar = LiquidGlassSettings(
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
    shadowElevation: 2.0,
  );

  /// Dark large panels.
  static const LiquidGlassSettings darkSurface = LiquidGlassSettings(
    blur: 10,
    thickness: 55,
    lightIntensity: 3.0,
    lightAngle: lightAngle,
    glassColor: Color(0x22FFFFFF), // ~13%
    refractiveIndex: 2.0,
    ambientStrength: 0.10,
    saturation: 1.6,
    glowIntensity: 1.5,
    chromaticAberration: 0.08,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1.0,
  );

  /// Dark standard cards.
  static const LiquidGlassSettings darkCard = LiquidGlassSettings(
    blur: 12,
    thickness: 45,
    lightIntensity: 2.5,
    lightAngle: lightAngle,
    glassColor: darkGlass,
    refractiveIndex: 1.8,
    ambientStrength: 0.08,
    saturation: 1.5,
    glowIntensity: 1.2,
    chromaticAberration: 0.06,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1.0,
  );

  /// Dark modal bottom sheet.
  static const LiquidGlassSettings darkSheet = LiquidGlassSettings(
    blur: 16,
    thickness: 45,
    lightIntensity: 2.0,
    lightAngle: lightAngle,
    glassColor: Color(0x2AFFFFFF), // ~16 % white
    refractiveIndex: 1.6,
    ambientStrength: 0.10,
    saturation: 1.5,
    glowIntensity: 0.9,
    chromaticAberration: 0.04,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1.0,
  );

  /// Dark chat input.
  static const LiquidGlassSettings darkInput = LiquidGlassSettings(
    blur: 12,
    thickness: 40,
    lightIntensity: 2.0,
    lightAngle: lightAngle,
    glassColor: Color(0x2AFFFFFF), // ~16 % white
    refractiveIndex: 1.6,
    ambientStrength: 0.10,
    saturation: 1.5,
    glowIntensity: 0.9,
    chromaticAberration: 0.04,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1.0,
  );

  /// Dark interactive elements.
  static const LiquidGlassSettings darkInteractive = LiquidGlassSettings(
    blur: 12,
    thickness: 40,
    lightIntensity: 2.5,
    lightAngle: lightAngle,
    glassColor: darkGlassStrong,
    refractiveIndex: 1.8,
    ambientStrength: 0.12,
    saturation: 1.5,
    glowIntensity: 1.2,
    chromaticAberration: 0.05,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1.0,
  );

  /// Dark small tags / chips.
  static const LiquidGlassSettings darkTag = LiquidGlassSettings(
    blur: 10,
    thickness: 35,
    lightIntensity: 1.8,
    lightAngle: lightAngle,
    glassColor: darkGlass,
    refractiveIndex: 1.6,
    ambientStrength: 0.08,
    saturation: 1.4,
    glowIntensity: 0.8,
    chromaticAberration: 0.04,
    specularSharpness: GlassSpecularSharpness.sharp,
    shadowElevation: 1.0,
  );
}
