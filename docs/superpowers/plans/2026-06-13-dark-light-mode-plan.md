# 深色/浅色模式切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Profile 页添加深色/浅色模式切换开关，同步用户选择的主题色到两种模式

**Architecture:** 新增 `themeModeProvider`（`StateProvider<ThemeMode>`），StorageService 新增 `saveThemeMode`/`loadThemeMode`。`MainApp` 中 watch 两个 provider（themeAccent + themeMode），动态构建 light/dark 主题。暗色模式玻璃参数使用单独预设。

**Tech Stack:** Flutter Web (PWA), Riverpod, liquid_glass_widgets, Hive

---

### Task 1: StorageService — 持久化主题模式

**Files:**
- Modify: `lib/services/storage_service.dart`

- [ ] **Step 1: 添加 themeMode 持久化方法**

在 `loadThemeColor()` 方法之后，`_serialize` 之前添加：

```dart
  // ── Theme mode ────────────────────────────────────────────────────

  Future<void> saveThemeMode(String mode) async {
    await _settingsBox?.put('themeMode', mode);
  }

  Future<String?> loadThemeMode() async {
    return _settingsBox?.get('themeMode');
  }
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/storage_service.dart
git commit -m "feat: add themeMode persistence to StorageService"
```

---

### Task 2: `theme.dart` — 暗色主题动态化

**Files:**
- Modify: `lib/core/theme.dart`

- [ ] **Step 1: 删除旧的静态 darkTheme，添加动态构造函数**

将整个文件替换为：

```dart
import 'package:flutter/material.dart';

class AppTheme {
  static const String defaultAccentHex = '#E88DAA';
  static const Color defaultAccent = Color(0xFFE88DAA);

  // Light theme palette
  static const Color surfaceLightMedium = Color(0xFFEDE4F0);
  static const Color surfaceLightAccent = Color(0xFFE0D4E8);
  static const Color textLightPrimary = Color(0xFF2D1B3E);
  static const Color textLightSecondary = Color(0xFF7A6B8A);

  // Dark theme palette
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

  /// Derive a very dark tint (≈10% accent + 90% dark) for dark scaffold.
  static Color darkScaffoldBgFromAccent(Color accent) {
    return Color.lerp(accent, const Color(0xFF1A1A2E), 0.90)!;
  }

  static Color moodColorFromHex(String hex) {
    final color = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
    if (color == null) return accent;
    return Color(color | 0xFF000000);
  }

  /// Returns a two-color gradient pair derived from [color] for use in
  /// cover images and thumbnails.
  static List<Color> gradientPairFromMood(Color color) {
    final hsl = HSLColor.fromColor(color);
    return [
      hsl.withLightness(0.55).withSaturation(0.8).toColor(),
      hsl.withLightness(0.35).withSaturation(0.6).toColor(),
    ];
  }

  /// Build a light [ThemeData] whose primary colour and scaffold background
  /// are derived from [accentHex].
  static ThemeData lightThemeFromHex(String accentHex) {
    final color = moodColorFromHex(accentHex);
    return lightThemeFromColor(color);
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

  /// Build a dark [ThemeData] whose primary colour is derived from
  /// [accentHex].
  static ThemeData darkThemeFromHex(String accentHex) {
    final color = moodColorFromHex(accentHex);
    return darkThemeFromColor(color);
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
```

关键变化：
- 新增 `darkScaffoldBgFromAccent` — 深色背景也微微染上强调色
- 新增 `darkThemeFromHex(String)` / `darkThemeFromColor(Color)`
- 旧的 `darkTheme` getter 改为调用 `darkThemeFromColor(accent)` 保持兼容

- [ ] **Step 2: Commit**

```bash
git add lib/core/theme.dart
git commit -m "feat: make dark theme accept dynamic accent color"
```

---

### Task 3: `glass_config.dart` — 暗色模式玻璃预设

**Files:**
- Modify: `lib/core/glass_config.dart`

- [ ] **Step 1: 添加暗色玻璃色值和预设**

在 `coolWhiteStrong` 定义之后添加：

```dart
  /// Semi-transparent white for dark-mode glass.
  static const Color darkGlass = Color(0x2DFFFFFF);  // ~18% white

  /// Slightly stronger white for dark-mode interactive elements.
  static const Color darkGlassStrong = Color(0x38FFFFFF);  // ~22% white
```

在文件末尾（`tag` 预设之后）添加所有暗色预设：

```dart
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
    glassColor: Color(0x22FFFFFF),  // ~13%
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
    glassColor: Color(0x2AFFFFFF),
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
    glassColor: Color(0x2AFFFFFF),
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/core/glass_config.dart
git commit -m "feat: add dark-mode glass presets"
```

---

### Task 4: `main.dart` — 添加 themeModeProvider 并动态切换主题

**Files:**
- Modify: `lib/main.dart`

- [ ] **Step 1: 添加 themeModeProvider 并改造 MainApp**

将 `themeAccentProvider` 定义之后添加：

```dart
final themeModeProvider = StateProvider<ThemeMode>((ref) {
  throw UnimplementedError('themeModeProvider must be overridden in main');
});
```

将 `main()` 中的 `runApp` 部分改为：

```dart
  final savedMode = (await storageService.loadThemeMode()) ?? 'light';
  final initialMode = savedMode == 'dark' ? ThemeMode.dark : ThemeMode.light;

  runApp(
    ProviderScope(
      overrides: [
        storageServiceProvider.overrideWithValue(storageService),
        themeAccentProvider.overrideWith((ref) => savedColor),
        themeModeProvider.overrideWith((ref) => initialMode),
      ],
      child: const MainApp(),
    ),
  );
```

将 `MainApp.build` 改造为：

```dart
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accentHex = ref.watch(themeAccentProvider);
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    return MaterialApp(
      title: 'Meloday',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightThemeFromHex(accentHex),
      darkTheme: AppTheme.darkThemeFromHex(accentHex),
      themeMode: themeMode,
      home: const AppShell(),
      onGenerateRoute: (settings) {
        if (settings.name == '/card') {
          final cardId = settings.arguments as String;
          return MaterialPageRoute(
            builder: (_) => CardDetailPage(cardId: cardId),
          );
        }
        return null;
      },
    );
  }
```

注意：删除了 `darkTheme: AppTheme.darkTheme` 的旧引用和 `themeMode: ThemeMode.light` 的硬编码，`themeMode` 现在指向 `themeModeProvider` 的值。`darkTheme` 也使用 `darkThemeFromHex` 确保主题色同步。

- [ ] **Step 2: Commit**

```bash
git add lib/main.dart
git commit -m "feat: add themeModeProvider, wire dynamic theme switching"
```

---

### Task 5: Profile 页 — 添加深色模式开关

**Files:**
- Modify: `lib/features/profile/pages/profile_page.dart`

- [ ] **Step 1: 在主题色选择器和"设置"行之间添加深色模式开关**

在 `_ThemeColorPicker` 下方（约第 60 行附近），`const SizedBox(height: 24)` 之后，`// ── Settings` 之前，添加：

```dart
              const SizedBox(height: 4),
              // ── Dark mode toggle ────────────────────────────────────
              _DarkModeToggle(),
              const SizedBox(height: 24),
```

- [ ] **Step 2: 添加 `_DarkModeToggle` widget 类**

在 `_ThemeColorPicker` 类之前（或在文件末尾的 `_Tile` 类之后）添加：

```dart
// ──────────────────────────────────────────────────────────────────────
// Dark mode toggle
// ──────────────────────────────────────────────────────────────────────

class _DarkModeToggle extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 14),
      settings: GlassConfig.card,
      child: ListTile(
        leading: Icon(
          isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
          color: Theme.of(context).colorScheme.onSurface,
        ),
        title: Text(
          '深色模式',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        trailing: Switch(
          value: isDark,
          activeColor: Theme.of(context).colorScheme.primary,
          onChanged: (value) {
            final newMode = value ? ThemeMode.dark : ThemeMode.light;
            ref.read(themeModeProvider.notifier).state = newMode;
            ref.read(storageServiceProvider).saveThemeMode(
                  value ? 'dark' : 'light',
                );
          },
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}
```

- [ ] **Step 3: 更新 import 以包含 ThemeMode**

确认文件顶部已有：
```dart
import 'package:flutter/material.dart';
```

同时需要确保 `storageServiceProvider` 的 import 存在（已有 `import '../../../main.dart';`），其中包含了 `themeModeProvider` 和 `storageServiceProvider`。

- [ ] **Step 4: Commit**

```bash
git add lib/features/profile/pages/profile_page.dart
git commit -m "feat: add dark mode toggle to profile page"
```

---

### Task 6: AppShell — 动态切换玻璃预设

**Files:**
- Modify: `lib/app.dart`

- [ ] **Step 1: 让 AppShell 根据主题模式切换玻璃预设**

当前 `AppShell` 是 `StatefulWidget`，但在 `_buildBottomNav` 中直接引用 `GlassConfig.navBar`。需要改为：

```dart
  Widget _buildBottomNav() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 12),
        child: GlassContainer(
          shape: const LiquidRoundedSuperellipse(borderRadius: 30),
          settings: isDark ? GlassConfig.darkNavBar : GlassConfig.navBar,
          // ... rest unchanged
```

- [ ] **Step 2: Commit**

```bash
git add lib/app.dart
git commit -m "feat: switch glass preset based on theme mode in AppShell"
```

---

### Self-Review Checklist

- [ ] **Spec coverage:**
  - Profile 页添加深色模式开关 → Task 5 ✅
  - 暗色玻璃预设 → Task 3 ✅
  - 暗色主题动态化 → Task 2 ✅
  - themeModeProvider → Task 4 ✅
  - 持久化 → Task 1 ✅
  - 主题色同步到暗色模式 → Task 4 (`darkThemeFromHex(accentHex)`) ✅
- [ ] **Placeholder scan:** 所有步骤都有完整代码，没有 TBD/TODO ✅
- [ ] **Type consistency:**
  - `darkThemeFromHex` / `darkThemeFromColor` 在 Task 2 定义，在 Task 4 调用 — 一致 ✅
  - `saveThemeMode(String)` / `loadThemeMode()` 在 Task 1 定义 — 一致 ✅
  - GlassConfig 的 darkNavBar/darkCard 等在 Task 3 定义，在 Task 6 引用 — 一致 ✅
