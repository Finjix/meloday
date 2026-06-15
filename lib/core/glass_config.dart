import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';

/// Centralised liquid-glass presets for Meloday — light mode only.
/// Meloday 玻璃拟态预设参数（仅浅色模式）。
abstract final class GlassConfig {
  GlassConfig._();

  /// Apple-standard upper-left light source.
  /// Apple 标准光源方向：左上角（0.75π ≈ 135°，即左上方）。
  static const double lightAngle = 0.75 * math.pi;

  /// Unified light-mode glass settings (based on the bottom nav bar).
  /// 统一浅色模式玻璃材质参数（以底部导航栏为基准）。
  static const LiquidGlassSettings light = LiquidGlassSettings(
    /// 模糊半径 — 控制背景透过玻璃后的模糊程度。值越大越模糊，0 为完全透明。
    blur: 5,

    /// 厚度 — 玻璃体的视觉厚度，影响折射偏移和边缘效果。
    thickness: 1,

    /// 光照强度 — 模拟光源打在玻璃表面的亮度，值越大高光越亮。
    lightIntensity: 3.0,

    /// 光源角度 — 以弧度表示的光源方向，0 为正右方，逆时针递增。
    lightAngle: lightAngle,

    /// 玻璃颜色 — 玻璃本体的颜色，通常用极低透明度的白色模拟磨砂玻璃。
    glassColor: Color.fromARGB(0, 255, 255, 255),

    /// 折射率 — 控制玻璃对背景内容的折射扭曲程度。1 为无折射，1.5 接近真实玻璃。
    refractiveIndex: 1.5,

    /// 环境光强度 — 模拟环境漫反射光打在玻璃上的亮度，值越大玻璃整体越暗。
    ambientStrength: 0.1,

    /// 饱和度 — 玻璃颜色的饱和度。1.0 为原始色，0 为完全去色。
    saturation: 1.0,

    /// 辉光强度 — 玻璃边缘的发光（发光）效果强度。值越大光晕越明显。
    glowIntensity: 1.0,

    /// 色差 — 模拟光线穿过玻璃棱镜的色散效果，值越大彩虹边越明显。
    chromaticAberration: 0.1,

    /// 高光锐度 — 控制高光斑的锐利程度。`sharp` 为锐利高光，`smooth` 为柔和散射。
    specularSharpness: GlassSpecularSharpness.sharp,

    /// 阴影高度 — 玻璃容器下方的投影高度，值越大阴影越深、扩散越远。
    shadowElevation: 1,
  );

  // ── Semantic aliases 语义别名 ─────────────────────────────────────

  /// 底部导航栏胶囊
  static const LiquidGlassSettings navBar = light;

  /// 通用卡片/面板表面
  static const LiquidGlassSettings surface = light;

  /// 音乐日记卡片
  static const LiquidGlassSettings card = light;

  /// 底部弹出层
  static const LiquidGlassSettings sheet = light;

  /// 可交互组件（按钮、FAB 等）
  static const LiquidGlassSettings interactive = light;

  /// 标签/徽章
  static const LiquidGlassSettings tag = light;

  /// 交互式椭圆按钮的乳白色边缘线。
  /// Opaque white rim used on interactive oval buttons (e.g. ChatFab).
  static const Color buttonRimWhite = Color(0x55FFFFFF);

  // ── Gradient fades 渐变遮罩 ────────────────────────────────────────

  /// 顶部渐变遮罩高度 — 与顶部 Agent 容器重合，让文本向上滚动时逐渐淡出。
  static const double topFadeHeight = 110;

  /// 顶部渐变断点 — 控制顶部淡出的快慢。[0]=起始,[1]=结束。间距越小过渡越急。
  static const List<double> topFadeStops = [0.0, 1.0];

  /// 底部渐变遮罩高度 — 在导航栏上方，让内容向下滚动时逐渐淡出。
  static const double bottomFadeHeight = 144;

  /// 底部渐变断点 — 控制底部淡出的快慢。[0]=起始,[1]=结束。间距越小过渡越急。
  static const List<double> bottomFadeStops = [0.0, 1.0];
}
