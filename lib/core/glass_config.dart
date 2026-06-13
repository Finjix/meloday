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
    blur: 12, // 背景模糊量 — 值越大玻璃越雾化/磨砂
    thickness: 45, // 玻璃厚度(逻辑像素) — 越厚折射越强，边缘扭曲更明显
    lightIntensity: 2.0, // 光源强度 — 越高高光越亮
    lightAngle: lightAngle, // 光源角度 — 0.75π = 左上角光源，Apple 标准
    glassColor: coolWhite, // 玻璃色调叠加层 — alpha 控制着色强度
    refractiveIndex: 1.8, // 折射率 — >1 产生光线扭曲，物理玻璃约 1.5
    ambientStrength: 0.08, // 环境光强度 — 越高暗部越亮，对比度降低
    saturation: 1.5, // 透过玻璃的背景饱和度 — 1.0 不变，>1 更鲜艳
    glowIntensity: 1.0, // 菲涅尔边缘辉光 — 控制玻璃边缘发光亮度(仅 Standard 路径)
    chromaticAberration: 0.05, // 色差/色散 — RGB 通道分离程度，产生彩色条纹
    specularSharpness: GlassSpecularSharpness.sharp, // 高光锐度 — sharp=镜面感，medium=iOS 26 默认，soft=磨砂
    shadowElevation: 0.8, // 阴影缩放(仅 Light 模式) — 0=无阴影，1=Apple 基准，>1 更强
  );

  /// Unified dark-mode glass settings.
  static const LiquidGlassSettings dark = LiquidGlassSettings(
    blur: 12, // 背景模糊量 — 值越大玻璃越雾化/磨砂
    thickness: 45, // 玻璃厚度(逻辑像素) — 越厚折射越强，边缘扭曲更明显
    lightIntensity: 2.0, // 光源强度 — 越高高光越亮
    lightAngle: lightAngle, // 光源角度 — 0.75π = 左上角光源，Apple 标准
    glassColor: darkGlass, // 玻璃色调叠加层 — 暗色模式用 20% 半透白
    refractiveIndex: 1.8, // 折射率 — >1 产生光线扭曲，物理玻璃约 1.5
    ambientStrength: 0.08, // 环境光强度 — 越高暗部越亮，对比度降低
    saturation: 1.5, // 透过玻璃的背景饱和度 — 1.0 不变，>1 更鲜艳
    glowIntensity: 1.0, // 菲涅尔边缘辉光 — 控制玻璃边缘发光亮度(仅 Standard 路径)
    chromaticAberration: 0.05, // 色差/色散 — RGB 通道分离程度，产生彩色条纹
    specularSharpness: GlassSpecularSharpness.sharp, // 高光锐度 — sharp=镜面感，medium=iOS 26 默认，soft=磨砂
    shadowElevation: 0.8, // 阴影缩放(仅 Light 模式有效，Dark 模式不会渲染阴影)
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
