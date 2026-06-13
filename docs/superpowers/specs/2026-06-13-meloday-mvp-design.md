# Meloday · 音乐日记 — MVP 设计规格

> 日期: 2026-06-13 | 版本: 0.1.0

---

## 1. 概述

Meloday 是一款基于 Flutter 的 PWA 音乐日记 App。用户描述当天发生的事情，AI Agent 通过引导式对话渐进披露用户心理需求，然后生成一张包含 AI 音乐、日记摘要、封面图片的音乐日记卡片。

**MVP 目标**: 不使用真实 AI API，用 Mock 数据跑通完整 UI 和交互流程。

---

## 2. 技术栈

| 项目 | 选择 |
|------|------|
| 框架 | Flutter Web (PWA) |
| 状态管理 | Riverpod |
| UI 组件库 | liquid_glass_widgets（玻璃拟态） |
| 本地存储 | Hive |
| 音乐播放 | 本地 MP3 文件 |
| 语言 | Dart 3.12+ |

---

## 3. 项目结构（Feature-First）

```
lib/
├── main.dart
├── app.dart                          # App Shell & 底部胶囊导航
├── core/
│   ├── theme.dart                    # 动态主题色系统
│   └── constants.dart                # 情绪标签、颜色映射
├── features/
│   ├── chat/                         # 首页对话
│   │   ├── providers/
│   │   │   └── conversation_provider.dart
│   │   ├── pages/
│   │   │   └── home_page.dart
│   │   └── widgets/
│   │       ├── agent_header.dart      # Agent 头像 + 当前消息（顶部）
│   │       ├── user_diary_list.dart   # 用户日记消息列表（中部）
│   │       ├── chat_input.dart        # 底部输入区
│   │       └── generating_progress.dart
│   ├── card/                         # 音乐日记卡片
│   │   ├── providers/
│   │   │   └── music_card_provider.dart
│   │   ├── pages/
│   │   │   └── card_detail_page.dart  # 展开态详情 + 播放器
│   │   └── widgets/
│   │       ├── music_card_compact.dart # 紧凑态卡片
│   │       └── music_player.dart      # 展开式播放器
│   ├── diary/                        # 日记本
│   │   ├── providers/
│   │   │   └── diary_list_provider.dart
│   │   ├── pages/
│   │   │   └── diary_page.dart
│   │   └── widgets/
│   │       └── timeline_list.dart
│   └── profile/                      # 个人页
│       └── pages/
│           └── profile_page.dart
├── models/
│   ├── chat_message.dart
│   ├── music_card.dart
│   ├── conversation_state.dart
│   └── generating_progress.dart
├── services/
│   ├── mock_agent_service.dart        # 模拟 Agent 对话逻辑
│   ├── mock_music_service.dart        # 模拟音乐生成
│   ├── mock_image_service.dart        # 模拟封面图片匹配
│   └── storage_service.dart           # Hive 本地存储
└── assets/
    ├── images/                        # 内置示例图片
    └── music/                         # 内置测试音乐
```

---

## 4. 导航 & App Shell

```
┌──────────────────────────────────────────────────┐
│              [当前页面内容区域]                     │
├──────────────────────────────────────────────────┤
│          🏠          📔          👤              │
│          首页       日记本       个人             │
│              (底部胶囊长条 · 仅图标)              │
└──────────────────────────────────────────────────┘
```

**要点:**
- 使用 `liquid_glass_widgets` 玻璃拟态胶囊容器
- `IndexedStack` 保持三个 Tab 页面状态
- 当前选中 Tab 图标高亮 + 动态氛围色
- 仅显示图标，无文字标签

**路由:**
- `/` → AppShell（IndexedStack）
- `/card/:id` → 卡片详情页（push 到导航栈，底部胶囊不可见）

---

## 5. 对话状态机

```
idle ⭢ greeting ⭢ chatting ⭢ generating ⭢ cardReady
                          ↑                        │
                          └────── [重新生成] ───────┘
                          
                          ⭢ error（任意阶段可重试）
```

**状态定义:**

| 状态 | 含义 | UI 表现 |
|------|------|---------|
| `idle` | 首次打开，等待 Agent 问候 | 空白或加载 |
| `greeting` | Agent 已发送问候，等待用户输入 | Agent 区显示问候语 |
| `chatting` | 对话进行中 | Agent 提问，用户回复，列表累积 |
| `generating` | 信息够了，正在生成音乐卡片 | Agent 区显示 4 步进度 |
| `cardReady` | 卡片已生成，可播放/保存 | Agent 区展示卡片 |
| `error` | 生成失败 | Agent 区显示错误 + 重试按钮 |

**Mock 阶段"信息完整度"判断规则:**
- 用户至少发过 2 条消息
- Agent 至少进行过 3 轮对话
- 满足条件后自动进入 `generating`

---

## 6. 首页 UI 布局

```
┌──────────────────────────────────────────────────┐
│  ┌────┐  ┌──────────────────────────────────┐   │
│  │ 🤖 │  │  Agent 当前消息（仅一条）          │   │
│  └────┘  │  新消息淡入覆盖旧消息              │   │
│          └──────────────────────────────────┘   │
│                                                  │
│  ─────────────── 分隔 ──────────────────────    │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │  🕐 14:30  用户日记消息 1                 │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │  🕐 14:32  用户日记消息 2                 │   │
│  └──────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────┐   │
│  │  🕐 14:35  用户日记消息 3                 │   │
│  └──────────────────────────────────────────┘   │
│          ↑ ListView 从旧到新排列                 │
│                                                  │
├──────────────────────────────────────────────────┤
│  💬 分享今天的点滴...                      📤   │
├──────────────────────────────────────────────────┤
│          🏠          📔          👤              │
└──────────────────────────────────────────────────┘
```

**交互规则:**
- 顶部 Agent 区：头像 + 文本容器，只显示最新一条 Agent 消息，新消息淡入切换
- 中部用户列表：日记式累积，`ListView` 从旧到新，新消息自动滚动到底部
- 生成进度/卡片也在 Agent 区展示
- 输入区固定在底部，生成中状态禁用输入
- Agent 回复模拟 300-500ms 延迟
- 生成进度每步间隔 1-2s

---

## 7. 音乐日记卡片

### 紧凑态（日记本列表中）
- 仅显示封面缩略图 + 卡片名字
- 点击进入展开态详情页

### 展开态（详情页 `/card/:id`）
- 封面大图
- 卡片名字（支持重命名✏️）
- 创建日期
- 日记摘要
- **「查看完整日记」按钮** — 点击展开/弹窗显示 AI 根据对话总结的完整日记内容
- 完整音乐播放器（播放/暂停、进度条、时间）
- 情绪标签列表
- 删除按钮

### 播放器
- 展开式，位于卡片详情页内
- 玻璃拟态进度条 + 控件按钮
- 内置 1 首测试音乐用于 Mock
- 播放/暂停切换，进度拖拽

---

## 8. 日记本（时间线）

- 左侧时间轴竖线（玻璃拟态半透明）
- 按日期分组，同一天多张卡片在同一节点下
- 日期圆点使用当天氛围色
- 每项显示：封面缩略图 + 卡片名 + 日期
- 点击进入卡片详情页
- 长按/左滑删除（`Dismissible`）
- 空状态：时间轴 + 引导文字「还没有日记，去首页写一篇吧 ✨」
- 卡片重命名支持

---

## 9. 个人页面

极简框架（Mock 阶段）：
- Emoji 头像
- 昵称：「Finjix 的音乐日记」
- 三个统计数字：总日记数、本月日记数、连续天数（Mock 数据）
- 设置入口（Mock 阶段不实现）
- 关于入口（简单 about 页）
- 使用 `liquid_glass_widgets` 玻璃卡片承载

---

## 10. 数据模型

```dart
enum ConvStatus { idle, greeting, chatting, generating, cardReady, error }

enum Sender { user, agent }

enum MessageType { text, progress, card }

class ChatMessage {
  final String id;
  final String content;
  final Sender sender;
  final DateTime timestamp;
  final MessageType type;
  final GeneratingProgress? progress;
  final String? cardId;
}

class GeneratingProgress {
  final int currentStep;     // 1-4
  final int totalSteps;      // 4
  final String stepName;     // "分析心情"|"编写提示词"|"生成音乐"|"匹配封面"
}

class MusicCard {
  final String id;
  String name;               // 可修改
  final String summary;      // 卡片摘要（1-2 句话）
  final String fullContent;  // AI 总结的完整日记内容（对话长文总结）
  final String coverImage;   // 本地 asset 路径
  final String musicFile;    // 本地文件路径
  final DateTime createdAt;
  final List<String> tags;
  final String moodColor;    // hex, e.g. "#FF8C42"
}
```

**Hive 持久化:**
- `MusicCard` 存入 Hive Box `'cards'`
- 对话消息仅内存存储，每次打开首页是新对话
- `ChatMessage` 不持久化

---

## 11. 动态氛围色系统

每张卡片根据情绪匹配氛围色，视觉上每张卡片有独特气质：

| 情绪标签 | 氛围色 |
|----------|--------|
| 温暖 | `#FF8C42` 暖橙 |
| 快乐 | `#FFD93D` 明黄 |
| 平静 | `#6EC6A0` 柔绿 |
| 伤感 | `#7B8FCC` 雾蓝 |
| 浪漫 | `#E88DAA` 粉紫 |
| 怀旧 | `#C4A882` 褐金 |
| 思念 | `#8BA4D6` 浅蓝 |
| (默认) | `#A0A0B0` 中性灰蓝 |

---

## 12. 异常状态

- **网络错误**: Agent 区显示「连接失败，请检查网络后重试」+ 重试按钮
- **生成失败**: Agent 区显示「创作失败了，让我再试一次好吗？」+ 重新生成按钮
- **空状态**: 日记本为空时显示引导语
- **加载态**: 骨架屏/脉冲动画占位

---

## 13. Mock 服务设计

### MockAgentService
- 预置对话树：根据用户关键词匹配预设回复
- 模拟信息完整度追踪（内部计数器）
- 返回 `Future.delayed` 模拟网络延迟

### MockMusicService
- 返回内置测试音乐文件路径
- 模拟 2s 生成延迟

### MockImageService
- 根据情绪/关键词匹配内置示例图片
- 预置 5-8 张不同场景图片（食物、风景、人物剪影等）
- 无匹配时返回渐变占位色

### StorageService
- Hive 封装，提供 CRUD 操作
- `saveCard(MusicCard)` / `deleteCard(String id)` / `getAllCards()` / `updateCardName(String id, String name)`
