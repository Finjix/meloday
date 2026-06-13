# 玻璃质感配置

Meloday 使用 [`liquid_glass_widgets`](https://github.com/sdegenaar/liquid_glass_widgets) 实现 iOS 26 风格的 Liquid Glass 效果。本文档记录最终的配置方案和调优经验。

---

## 架构

```
lib/core/glass_config.dart   — 所有玻璃参数预设（唯一调优入口）
lib/main.dart                — Shader 预加载（必须）
lib/**/*.dart                — 各组件引用 GlassConfig.xxx 预设
```

## 关键文件

| 文件 | 作用 |
|------|------|
| `lib/core/glass_config.dart` | 8 个场景预设 + 2 个色值常量 |
| `lib/main.dart` | `LiquidGlassWidgets.initialize()` + `LightweightLiquidGlass.preWarm()` |
| 所有 `GlassContainer` 调用处 | `settings: GlassConfig.card` 等 |

---

## 预设一览

| 预设 | 场景 | blur | thickness | lightIntensity | glassColor |
|------|------|------|-----------|----------------|------------|
| `navBar` | 底部导航栏 | 12 | 45 | 2.0 | 13% coolWhite |
| `surface` | 封面/大面板 | 10 | **55** | **3.0** | 12% coolWhite |
| `card` | 标准卡片 | 12 | 45 | 2.5 | 13% coolWhite |
| `sheet` | 底部弹窗 | **16** | 45 | 2.0 | **16%** coolWhite |
| `input` | 聊天输入框 | 12 | 40 | 2.0 | 16% coolWhite |
| `interactive` | 按钮/头像 | 12 | 40 | 2.5 | **16%** coolWhiteStrong |
| `tag` | 标签芯片 | 10 | 35 | 1.8 | 13% coolWhite |

所有预设共享：
- `lightAngle`: 135° 左上光源（Apple 标准）
- `refractiveIndex`: 1.6–2.0
- `glowIntensity`: 0.8–1.5
- `chromaticAberration`: 0.04–0.08
- `specularSharpness`: sharp
- `shadowElevation`: 1.5–4.0
- `saturation`: 1.4–1.6

---

## 核心设计决策

### 1. 凉白色调 (`#F4F8FA`) 而非纯白

背景是暖粉色 `#FCEEF2`，如果用纯白 `glassColor`，在白底上完全不可见。改用微凉白 `#F4F8FA`，与暖粉背景形成色温反差，玻璃层能肉眼可辨。

```dart
// 暖粉背景（theme.dart）
static Color scaffoldBgFromAccent(Color accent) {
  return Color.lerp(accent, Colors.white, 0.85)!; // ≈ #FCEEF2
}

// 凉白玻璃（glass_config.dart）
static const Color coolWhite = Color(0x21F4F8FA); // 13% alpha
```

### 2. 低模糊 + 高厚度 + 高光强

- `blur`: 10–16 — 足够产生雾面感，但背景仍清晰
- `thickness`: 35–55 — 宽度足够的边缘高光
- `lightIntensity`: 1.8–3.0 — 反光强烈

这三个参数配合产生「晶莹剔透」的厚切水晶质感。

### 3. Shader 必须预加载

Flutter Web 上 `.frag` shader 异步加载，若加载失败则降级为纯色矩形。必须在 `main()` 中同步预预热：

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LiquidGlassWidgets.initialize();          // 初始化组件库
  await LightweightLiquidGlass.preWarm();         // 预编译 Fragment Shader
  // ...
}
```

### 4. 渲染路径

| 质量 | 渲染引擎 | 适用场景 | 在 Meloday |
|------|----------|----------|------------|
| `standard` (默认) | `.frag` Shader + BackdropFilter | 所有组件 | **当前使用** |
| `minimal` | BackdropFilter + Canvas 高光 | 低端设备 | 避免使用（布局兼容问题） |

`standard` 路径的 Shader 加载后效果最好，所有参数（glow、chromatic aberration、specular sharpness）都传给 GPU。

---

## 调优经验

### 参数试探优先级

1. **`glassColor`** — 最影响观感。背景色+玻璃色的互动决定「玻璃层是否可见」
2. **`blur`** — 第二重要。够高才能产生雾面层，但不能遮住背景
3. **`lightIntensity` + `thickness`** — 控制边缘高光的亮度和宽度
4. **`glowIntensity`** — 菲涅尔辉光，从边缘向内渐变，是「玻璃感」的核心
5. **`chromaticAberration`** — 极微妙但提升高级感

### 常见陷阱

| 陷阱 | 表现 | 解决 |
|------|------|------|
| `glassColor` 等于背景色 | 玻璃不可见 | 用互补色温的白 |
| Shader 未预加载 | 纯色矩形 + 阴影 | 加 `preWarm()` |
| `GlassQuality.minimal` | 布局溢出 + 无高光谱 | 不要全局强制 minimal |
| `useOwnLayer: false` 嵌套在另一 GlassContainer 内 | 设置被父层覆盖 | 加 `useOwnLayer: true` |
| 背景太均匀 | 模糊无效果 | 确保背景有内容让模糊「变形」 |

---

## Flutter Web 特别说明

- 必须使用 Dart Dev Compiler（`flutter run -d chrome` 默认）
- Shader 文件通过 `flutter > shaders:` 在 pubspec.yaml 中声明
- `LiquidGlassWidgets.initialize()` 内部调用 `ShaderCompiler` 预热
- 在 Chrome DevTools Console 中看到 `[LightweightGlass] ✓` 即 Shader 加载成功

---

## 参考

- [liquid_glass_widgets 源码](https://github.com/sdegenaar/liquid_glass_widgets)
- [GLASS_MODAL_SHEETS_GUIDE.md](../D:/liquid_glass_widgets-main/docs/GLASS_MODAL_SHEETS_GUIDE.md)
- [LIQUID_MORPH_ENGINE.md](../D:/liquid_glass_widgets-main/docs/LIQUID_MORPH_ENGINE.md)
