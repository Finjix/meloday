# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Meloday（音乐日记）是一款 Flutter Web PWA。用户描述当天心情 → AI Agent 引导式对话 → 生成含 AI 音乐、日记摘要、封面图的音乐日记卡片。当前 MVP 阶段使用 Mock 服务跑通完整 UI 流程，不接入真实 AI API。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Flutter Web (PWA)，Dart 3.12+ |
| 状态管理 | Riverpod (`StateNotifierProvider` + `FutureProvider.family`) |
| UI 组件库 | `liquid_glass_widgets`（玻璃拟态），Git 依赖 `sdegenaar/liquid_glass_widgets` |
| 本地存储 | Hive (`Box<String>` + JSON 序列化) |
| 音频播放 | `audioplayers` |
| ID 生成 | `uuid` |
| 日期格式化 | `intl` |

## 项目结构（Feature-First）

```
lib/
├── main.dart              # 入口：Hive 初始化，ProviderScope，路由配置
├── app.dart               # AppShell：IndexedStack + 玻璃拟态胶囊底栏
├── core/theme.dart        # AppTheme：暗色玻璃拟态调色板 + moodColorFromHex
├── models/                # 共享数据模型（全部不可变，用 copyWith）
├── services/              # Mock 服务 + Hive 存储
└── features/
    ├── chat/              # 首页对话
    │   ├── providers/     # conversation_provider（状态机核心）
    │   ├── pages/         # home_page
    │   └── widgets/       # agent_header, user_diary_list, chat_input, generating_progress
    ├── card/              # 音乐日记卡片
    │   ├── providers/     # music_card_provider
    │   ├── pages/         # card_detail_page（展开态详情）
    │   └── widgets/       # music_player, music_card_compact
    ├── diary/             # 日记本
    │   ├── providers/     # diary_list_provider
    │   ├── pages/         # diary_page
    │   └── widgets/       # timeline_list（按日期分组的时间线）
    └── profile/           # 个人页
        └── pages/         # profile_page
```

## 架构核心：对话状态机

整个 App 由 `ConversationNotifier` 驱动的 6 状态流转控制：

```
idle → greeting → chatting → generating → cardReady
                       ↑                      │
                       └── [重新生成] ─────────┘
                       → error（任意阶段可重试）
```

**Mock 阶段信息完整度判断**：用户消息数 ≥2 且 Agent 轮次 ≥3 时自动进入 `generating`。

## 关键模式

### 1. Provider 依赖注入

`storageServiceProvider` 在 `main.dart` 定义为抛出 `UnimplementedError` 的占位 Provider，在 `main()` 中通过 `ProviderScope(overrides:)` 注入真实实例。所有需要 StorageService 的 Provider 通过 `ref.watch(storageServiceProvider)` 获取。

### 2. Mock 服务设计

- `MockAgentService`：预置问候语 + 追问语料库，内部计数器追踪对话轮次
- `MockMusicService`：模拟 2s 延迟后返回 `assets/music/test.mp3`
- `MockImageService`：关键词匹配用户消息，返回预设图片路径，无匹配降级为 `default.jpg`

所有 Mock 方法返回 `Future`（模拟网络延迟），方便后续替换为真实 API。

### 3. Hive 存储

`StorageService` 使用 `Box<String>` + `jsonEncode`/`jsonDecode`（利用 `MusicCard.toJson()`/`fromJson()`）。测试中使用临时目录 `Directory.systemTemp.createTempSync()` + 静态标志位避免 Hive 单例重复初始化冲突。

### 4. 模型不可变性

`MusicCard` 所有字段 `final`，通过 `copyWith()` 创建修改后的新实例。`ConversationState` 同理，`copyWith` 支持 `clearX` 标志位用于清空可选字段。

### 5. liquid_glass_widgets API

该组件库使用 `GlassContainer` + `LiquidRoundedSuperellipse`/`LiquidOval` + `LiquidGlassSettings(blur: N)` 而非简单的 `borderRadius`/`blur` 参数。`withOpacity()` 替换为 `withValues(alpha:)`（Flutter 新版 API）。参考已有 widget 文件中的用法。

### 6. Lint 约定

私有字段 + 公开命名参数的构造函数中使用 `// ignore_for_file: prefer_initializing_formals`。这是 StateNotifier 私有字段无法使用 `this._field` 初始化形式的已知约定。

## 路由

| 路径 | 页面 | 参数 |
|------|------|------|
| `/` | AppShell（IndexedStack 三 Tab） | — |
| `/card` | CardDetailPage | `arguments: String cardId` |

路由配置在 `main.dart` 的 `MaterialApp.onGenerateRoute` 中。

## 测试

- `test/models/music_card_test.dart` — MusicCard 创建 + copyWith
- `test/services/storage_service_test.dart` — Hive CRUD 操作（initForTest）
- `test/services/mock_agent_service_test.dart` — Agent 问候、追问、完整度判断逻辑
- `test/features/chat/conversation_provider_test.dart` — 状态机 idle→greeting→chatting 流转

测试中使用 `StorageService.initForTest()` 获取内存 Hive 实例。
