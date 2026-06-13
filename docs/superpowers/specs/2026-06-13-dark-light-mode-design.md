# 深色/浅色模式切换 + 主题色同步

## 概述

在 Profile 页面添加深色/浅色模式切换开关，同时将用户选择的主题色同步应用到深色主题，确保两种模式下主题色一致。

## 改动文件

### 1. `lib/core/theme.dart` — 暗色主题动态化

- 新增 `darkThemeFromHex(String accentHex)` / `darkThemeFromColor(Color accentColor)`
- 暗色 scaffold 背景使用 `accent` 调和（与 light 保持一致的派生方式）
- 删除静态 `darkTheme` getter

### 2. `lib/core/glass_config.dart` — 暗色模式玻璃预设

- 新增 `darkGlass` 色值（`0x28FFFFFF`）
- 为暗色模式添加 `darkNavBar`、`darkCard`、`darkSurface`、`darkSheet`、`darkInput`、`darkInteractive`、`darkTag`
- 所有 `dark*` 预设使用 `darkGlass` 替换 `coolWhite`，`shadowElevation` 调低（深色背景上阴影不明显）

### 3. `lib/main.dart` — themeModeProvider

- 新增 `themeModeProvider`（`StateProvider<ThemeMode>`）
- `MainApp.build` 中 watch `themeModeProvider`，动态设置 `themeMode`
- 启动时从 StorageService 加载保存的 mode，fallback 为 `ThemeMode.light`
- `themeAccentProvider` 和 `themeModeProvider` 都在 `main()` 中 override

### 4. `lib/services/storage_service.dart` — 持久化

- 新增 `saveThemeMode(ThemeMode mode)` / `loadThemeMode()`
- 序列化 `ThemeMode` 为 `'light'` / `'dark'` 字符串

### 5. `lib/features/profile/pages/profile_page.dart` — UI

- 在主题色选择器和"设置" Tile 之间新增一行：
  - 图标：`Icons.dark_mode_outlined`
  - 文本："深色模式"
  - 右侧：`Switch` 组件
  - 切换时更新 `themeModeProvider` 并持久化
- 主题色选择器同步两种模式：切换主题色时，无论当前是 light 还是 dark，都使用同一颜色

## 数据流

```
main() 启动
  ├── storage.loadThemeColor() → themeAccentProvider
  └── storage.loadThemeMode()  → themeModeProvider

Profile 页
  ├── 主题色选择 → themeAccentProvider.notifier.state = hex
  │                └── storage.saveThemeColor(hex)
  └── 深色模式开关 → themeModeProvider.notifier.state = mode
                     └── storage.saveThemeMode(mode)

MainApp.build
  ├── watch(themeAccentProvider) → lightThemeFromHex / darkThemeFromHex
  └── watch(themeModeProvider)   → themeMode
```

## 设计要点

- 切换主题模式没有动画，直接设置状态，Flutter 框架自动重建
- 暗色模式下的玻璃参数使用半透明白色，在深色背景上呈现霜面效果
- 暗色模式阴影 `shadowElevation` 降低（深色背景上阴影不可见）
- 两种模式的玻璃效果一致使用 `liquid_glass_widgets`，仅调整色值
