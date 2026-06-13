# Meloday MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Meloday MVP — a Flutter Web PWA with mock AI agent conversation flow, music diary card generation, diary notebook timeline, and profile page.

**Architecture:** Feature-first Flutter app with Riverpod state management, Hive local storage, liquid_glass_widgets glassmorphism UI, and audioplayers for music playback. The conversation state machine drives the core flow: idle → greeting → chatting → generating → cardReady.

**Tech Stack:** Flutter 3.12+ (Web/PWA), Riverpod, Hive, liquid_glass_widgets, audioplayers

---

### Task 1: Add required dependencies

**Files:**
- Modify: `pubspec.yaml`

- [ ] **Step 1: Update pubspec.yaml with new dependencies**

```yaml
name: meloday
description: "Meloday · 音乐日记 — AI-powered music diary"
publish_to: 'none'
version: 0.1.0+1

environment:
  sdk: ^3.12.2

dependencies:
  flutter:
    sdk: flutter
  liquid_glass_widgets:
    git:
      url: https://github.com/sdegenaar/liquid_glass_widgets
  flutter_riverpod: ^2.6.1
  riverpod_annotation: ^2.6.1
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  audioplayers: ^6.1.0
  uuid: ^4.5.1
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^6.0.0
  hive_generator: ^2.0.1
  build_runner: ^2.4.13

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/music/
```

- [ ] **Step 2: Install dependencies**

```bash
cd /d/meloday && flutter pub get
```

Expected: Exit code 0, all dependencies resolved.

- [ ] **Step 3: Create assets directories and placeholder files**

```bash
mkdir -p assets/images assets/music
# Create a placeholder to ensure directories are tracked by git
touch assets/images/.gitkeep
touch assets/music/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add pubspec.yaml pubspec.lock assets/
git commit -m "build: add Riverpod, Hive, audioplayers, uuid, intl dependencies"
```

---

### Task 2: Data models

**Files:**
- Create: `lib/models/chat_message.dart`
- Create: `lib/models/music_card.dart`
- Create: `lib/models/conversation_state.dart`
- Create: `lib/models/generating_progress.dart`
- Create: `lib/models/mood_colors.dart`
- Test: `test/models/music_card_test.dart`

- [ ] **Step 1: Write MusicCard test**

```dart
// test/models/music_card_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:meloday/models/music_card.dart';

void main() {
  group('MusicCard', () {
    test('should create with required fields', () {
      final card = MusicCard(
        id: 'test-id',
        name: '妈妈的味道',
        summary: '妈妈的烤鹅腿很香',
        fullContent: '今天回家，妈妈做了烤鹅腿...',
        coverImage: 'assets/images/food.jpg',
        musicFile: 'assets/music/test.mp3',
        createdAt: DateTime(2026, 6, 13),
        tags: ['温暖', '亲情'],
        moodColor: '#FF8C42',
      );

      expect(card.id, 'test-id');
      expect(card.name, '妈妈的味道');
      expect(card.tags, ['温暖', '亲情']);
    });

    test('name should be mutable', () {
      final card = MusicCard(
        id: 'test-id',
        name: '原始名字',
        summary: '摘要',
        fullContent: '完整内容',
        coverImage: 'cover.jpg',
        musicFile: 'music.mp3',
        createdAt: DateTime.now(),
        tags: [],
        moodColor: '#A0A0B0',
      );

      card.name = '新名字';
      expect(card.name, '新名字');
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /d/meloday && flutter test test/models/music_card_test.dart
```

Expected: FAIL — `music_card.dart` not found.

- [ ] **Step 3: Create GeneratingProgress model**

```dart
// lib/models/generating_progress.dart
class GeneratingProgress {
  final int currentStep;
  final int totalSteps;
  final String stepName;

  const GeneratingProgress({
    required this.currentStep,
    required this.totalSteps,
    required this.stepName,
  });

  static const List<String> stepNames = [
    '分析心情',
    '编写提示词',
    '生成音乐',
    '匹配封面',
  ];

  double get percent => currentStep / totalSteps;
}
```

- [ ] **Step 4: Create ChatMessage model**

```dart
// lib/models/chat_message.dart
import 'generating_progress.dart';

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

  const ChatMessage({
    required this.id,
    required this.content,
    required this.sender,
    required this.timestamp,
    this.type = MessageType.text,
    this.progress,
    this.cardId,
  });
}
```

- [ ] **Step 5: Create MusicCard model**

```dart
// lib/models/music_card.dart
class MusicCard {
  final String id;
  String name;
  final String summary;
  final String fullContent;
  final String coverImage;
  final String musicFile;
  final DateTime createdAt;
  final List<String> tags;
  final String moodColor;

  MusicCard({
    required this.id,
    required this.name,
    required this.summary,
    required this.fullContent,
    required this.coverImage,
    required this.musicFile,
    required this.createdAt,
    required this.tags,
    required this.moodColor,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'summary': summary,
    'fullContent': fullContent,
    'coverImage': coverImage,
    'musicFile': musicFile,
    'createdAt': createdAt.toIso8601String(),
    'tags': tags,
    'moodColor': moodColor,
  };

  factory MusicCard.fromJson(Map<String, dynamic> json) => MusicCard(
    id: json['id'] as String,
    name: json['name'] as String,
    summary: json['summary'] as String,
    fullContent: json['fullContent'] as String,
    coverImage: json['coverImage'] as String,
    musicFile: json['musicFile'] as String,
    createdAt: DateTime.parse(json['createdAt'] as String),
    tags: List<String>.from(json['tags'] as List),
    moodColor: json['moodColor'] as String,
  );
}
```

- [ ] **Step 6: Create ConversationState model**

```dart
// lib/models/conversation_state.dart
import 'chat_message.dart';
import 'generating_progress.dart';
import 'music_card.dart';

enum ConvStatus { idle, greeting, chatting, generating, cardReady, error }

class ConversationState {
  final ConvStatus status;
  final List<ChatMessage> userMessages;
  final ChatMessage? agentMessage;
  final GeneratingProgress? progress;
  final MusicCard? currentCard;
  final String? errorMessage;

  const ConversationState({
    this.status = ConvStatus.idle,
    this.userMessages = const [],
    this.agentMessage,
    this.progress,
    this.currentCard,
    this.errorMessage,
  });

  ConversationState copyWith({
    ConvStatus? status,
    List<ChatMessage>? userMessages,
    ChatMessage? agentMessage,
    GeneratingProgress? progress,
    MusicCard? currentCard,
    String? errorMessage,
    bool clearAgent = false,
    bool clearProgress = false,
    bool clearCard = false,
    bool clearError = false,
  }) {
    return ConversationState(
      status: status ?? this.status,
      userMessages: userMessages ?? this.userMessages,
      agentMessage: clearAgent ? null : (agentMessage ?? this.agentMessage),
      progress: clearProgress ? null : (progress ?? this.progress),
      currentCard: clearCard ? null : (currentCard ?? this.currentCard),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}
```

- [ ] **Step 7: Create MoodColors constants**

```dart
// lib/models/mood_colors.dart
class MoodColors {
  static const Map<String, String> tagToColor = {
    '温暖': '#FF8C42',
    '快乐': '#FFD93D',
    '平静': '#6EC6A0',
    '伤感': '#7B8FCC',
    '浪漫': '#E88DAA',
    '怀旧': '#C4A882',
    '思念': '#8BA4D6',
  };

  static const String defaultColor = '#A0A0B0';

  static String fromTags(List<String> tags) {
    for (final tag in tags) {
      if (tagToColor.containsKey(tag)) return tagToColor[tag]!;
    }
    return defaultColor;
  }
}
```

- [ ] **Step 8: Run tests to verify**

```bash
cd /d/meloday && flutter test test/models/music_card_test.dart
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/models/ test/models/
git commit -m "feat: add data models — ChatMessage, MusicCard, ConversationState, GeneratingProgress, MoodColors"
```

---

### Task 3: Core theme

**Files:**
- Create: `lib/core/theme.dart`

- [ ] **Step 1: Create theme file**

```dart
// lib/core/theme.dart
import 'package:flutter/material.dart';

class AppTheme {
  static const Color surfaceDark = Color(0xFF1A1A2E);
  static const Color surfaceMedium = Color(0xFF16213E);
  static const Color surfaceLight = Color(0xFF0F3460);
  static const Color textPrimary = Color(0xFFE8E8E8);
  static const Color textSecondary = Color(0xFFA0A0B0);
  static const Color accent = Color(0xFFE88DAA);

  static Color moodColorFromHex(String hex) {
    final color = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
    if (color == null) return accent;
    return Color(color | 0xFF000000);
  }

  static ThemeData get darkTheme => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: surfaceDark,
    colorScheme: const ColorScheme.dark(
      primary: accent,
      secondary: surfaceLight,
      surface: surfaceMedium,
    ),
    fontFamily: 'Roboto',
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/core/
git commit -m "feat: add core theme with dark glassmorphism palette"
```

---

### Task 4: Storage service

**Files:**
- Create: `lib/services/storage_service.dart`
- Modify: `lib/main.dart`
- Test: `test/services/storage_service_test.dart`

- [ ] **Step 1: Write storage service test**

```dart
// test/services/storage_service_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:meloday/models/music_card.dart';
import 'package:meloday/services/storage_service.dart';

void main() {
  group('StorageService', () {
    test('saveCard and getAllCards should work', () async {
      final service = StorageService();
      await service.initForTest();

      final card = MusicCard(
        id: 'test-1',
        name: '测试卡片',
        summary: '测试摘要',
        fullContent: '测试完整内容',
        coverImage: 'cover.jpg',
        musicFile: 'music.mp3',
        createdAt: DateTime(2026, 6, 13),
        tags: ['温暖'],
        moodColor: '#FF8C42',
      );

      await service.saveCard(card);
      final cards = await service.getAllCards();

      expect(cards.length, 1);
      expect(cards.first.id, 'test-1');
    });

    test('deleteCard should remove card', () async {
      final service = StorageService();
      await service.initForTest();

      await service.saveCard(MusicCard(
        id: 'test-2',
        name: '待删除',
        summary: '摘要',
        fullContent: '完整',
        coverImage: 'c.jpg',
        musicFile: 'm.mp3',
        createdAt: DateTime.now(),
        tags: [],
        moodColor: '#A0A0B0',
      ));

      await service.deleteCard('test-2');
      final cards = await service.getAllCards();
      expect(cards.length, 0);
    });

    test('updateCardName should rename card', () async {
      final service = StorageService();
      await service.initForTest();

      await service.saveCard(MusicCard(
        id: 'test-3',
        name: '旧名字',
        summary: '摘要',
        fullContent: '完整',
        coverImage: 'c.jpg',
        musicFile: 'm.mp3',
        createdAt: DateTime.now(),
        tags: [],
        moodColor: '#A0A0B0',
      ));

      await service.updateCardName('test-3', '新名字');
      final cards = await service.getAllCards();
      expect(cards.first.name, '新名字');
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /d/meloday && flutter test test/services/storage_service_test.dart
```

Expected: FAIL — `storage_service.dart` not found.

- [ ] **Step 3: Create StorageService**

```dart
// lib/services/storage_service.dart
import 'package:hive_flutter/hive_flutter.dart';
import '../models/music_card.dart';

class StorageService {
  static const String _boxName = 'cards';
  Box<String>? _box;

  Future<void> init() async {
    await Hive.initFlutter();
    _box = await Hive.openBox<String>(_boxName);
  }

  /// For tests: use in-memory Hive
  Future<void> initForTest() async {
    Hive.init('test_hive');
    _box = await Hive.openBox<String>('test_cards');
  }

  Future<void> saveCard(MusicCard card) async {
    await _box?.put(card.id, _serialize(card));
  }

  Future<List<MusicCard>> getAllCards() async {
    final cards = <MusicCard>[];
    for (final key in _box!.keys) {
      final json = _box!.get(key);
      if (json != null) cards.add(_deserialize(json));
    }
    cards.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return cards;
  }

  Future<MusicCard?> getCard(String id) async {
    final json = _box?.get(id);
    if (json == null) return null;
    return _deserialize(json);
  }

  Future<void> deleteCard(String id) async {
    await _box?.delete(id);
  }

  Future<void> updateCardName(String id, String newName) async {
    final card = await getCard(id);
    if (card != null) {
      card.name = newName;
      await saveCard(card);
    }
  }

  String _serialize(MusicCard card) {
    return '${card.id}||${card.name}||${card.summary}||${card.fullContent}||${card.coverImage}||${card.musicFile}||${card.createdAt.toIso8601String()}||${card.tags.join(',')}||${card.moodColor}';
  }

  MusicCard _deserialize(String raw) {
    final parts = raw.split('||');
    return MusicCard(
      id: parts[0],
      name: parts[1],
      summary: parts[2],
      fullContent: parts[3],
      coverImage: parts[4],
      musicFile: parts[5],
      createdAt: DateTime.parse(parts[6]),
      tags: parts[7].isEmpty ? [] : parts[7].split(','),
      moodColor: parts[8],
    );
  }
}
```

- [ ] **Step 4: Update main.dart to initialize Hive**

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app.dart';
import 'services/storage_service.dart';

final storageServiceProvider = Provider<StorageService>((ref) {
  throw UnimplementedError('StorageService must be overridden in main');
});

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storageService = StorageService();
  await storageService.init();
  runApp(
    ProviderScope(
      overrides: [
        storageServiceProvider.overrideWithValue(storageService),
      ],
      child: const MainApp(),
    ),
  );
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Meloday',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF1A1A2E),
      ),
      home: const AppShell(),
    );
  }
}
```

- [ ] **Step 5: Create minimal AppShell placeholder so main.dart compiles**

```dart
// lib/app.dart
import 'package:flutter/material.dart';

class AppShell extends StatelessWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Text('Meloday')),
    );
  }
}
```

- [ ] **Step 6: Run tests to verify**

```bash
cd /d/meloday && flutter test test/services/storage_service_test.dart
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/main.dart lib/app.dart lib/services/ test/services/
git commit -m "feat: add StorageService with Hive persistence for MusicCards"
```

---

### Task 5: Mock services

**Files:**
- Create: `lib/services/mock_agent_service.dart`
- Create: `lib/services/mock_music_service.dart`
- Create: `lib/services/mock_image_service.dart`
- Test: `test/services/mock_agent_service_test.dart`

- [ ] **Step 1: Write MockAgentService test**

```dart
// test/services/mock_agent_service_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:meloday/services/mock_agent_service.dart';

void main() {
  group('MockAgentService', () {
    late MockAgentService service;

    setUp(() {
      service = MockAgentService();
    });

    test('greeting should return non-empty message', () {
      final greeting = service.getGreeting();
      expect(greeting, isNotEmpty);
    });

    test('should track message count and determine completeness', () {
      // After 5 messages (3 agent rounds + 2 user), should be complete
      expect(service.isInfoComplete(0, 0), false);
      expect(service.isInfoComplete(2, 1), false); // user=2, agentRounds=1
      expect(service.isInfoComplete(2, 2), false); // user=2, agentRounds=2
      expect(service.isInfoComplete(2, 3), true);  // user=2, agentRounds=3 ✓
      expect(service.isInfoComplete(3, 3), true);  // user=3, agentRounds=3 ✓
      expect(service.isInfoComplete(1, 3), false); // user=1, agentRounds=3
    });

    test('getResponse should return a non-empty string', () {
      final response = service.getResponse('今天吃了好吃的');
      expect(response, isNotEmpty);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /d/meloday && flutter test test/services/mock_agent_service_test.dart
```

Expected: FAIL.

- [ ] **Step 3: Create MockAgentService**

```dart
// lib/services/mock_agent_service.dart
import 'dart:math';

class MockAgentService {
  final _random = Random();

  int _agentRound = 0;

  static const _greetings = [
    '嗨！今天过得怎么样？有什么想和我分享的吗？ 🌸',
    '你好呀～今天有什么故事想要记录下来吗？ ✨',
    '欢迎回来！今天的心情如何？说来听听吧 🎵',
  ];

  static const _followUps = [
    '听起来很有意思呢，当时你的心情是怎样的？',
    '能再多说一些细节吗？我想更了解那一刻的你～',
    '这件事给你带来了什么样的感受呢？',
    '那是什么样的感觉？像某种颜色或者旋律吗？',
    '如果可以给这一刻配上一段音乐，你希望是什么风格？',
    '除了这件事，今天还有什么让你印象深刻的小瞬间吗？',
    '你希望今天的音乐是什么情绪基调呢？温暖的、欢快的，还是平静的？',
    '真好，能感受到你的心情。还有其他想说的吗？',
    '我好像能理解那种感觉了～再和我多说一点吧',
  ];

  String getGreeting() {
    _agentRound = 0;
    return _greetings[_random.nextInt(_greetings.length)];
  }

  String getResponse(String userMessage) {
    _agentRound++;
    if (_agentRound < _followUps.length) {
      return _followUps[_agentRound - 1];
    }
    return _followUps[_random.nextInt(_followUps.length)];
  }

  bool isInfoComplete(int userMessageCount, int agentRounds) {
    return userMessageCount >= 2 && agentRounds >= 3;
  }

  void reset() {
    _agentRound = 0;
  }
}
```

- [ ] **Step 4: Create MockMusicService**

```dart
// lib/services/mock_music_service.dart
class MockMusicService {
  static const testMusicPath = 'assets/music/test.mp3';

  Future<String> generateMusic({
    required String prompt,
    required String mood,
  }) async {
    // Simulate generation delay
    await Future.delayed(const Duration(seconds: 2));
    return testMusicPath;
  }
}
```

- [ ] **Step 5: Create MockImageService**

```dart
// lib/services/mock_image_service.dart
import '../models/mood_colors.dart';

class MockImageService {
  // Maps keywords in user messages to matching asset images
  static const _keywordToImage = {
    '妈妈': 'assets/images/family.jpg',
    '烤鹅': 'assets/images/food.jpg',
    '吃': 'assets/images/food.jpg',
    '朋友': 'assets/images/friends.jpg',
    '雨': 'assets/images/rain.jpg',
    '旅行': 'assets/images/travel.jpg',
    '咖啡': 'assets/images/cafe.jpg',
    '跑步': 'assets/images/running.jpg',
    '音乐': 'assets/images/music.jpg',
    '花': 'assets/images/nature.jpg',
    '山': 'assets/images/nature.jpg',
    '海': 'assets/images/ocean.jpg',
  };

  Future<String> fetchImage({
    required List<String> tags,
    required String userMessages,
  }) async {
    // Simulate network fetch delay
    await Future.delayed(const Duration(milliseconds: 800));

    final lower = userMessages.toLowerCase();
    for (final entry in _keywordToImage.entries) {
      if (lower.contains(entry.key)) {
        return entry.value;
      }
    }
    // Fallback: return first available image or a gradient placeholder
    return 'assets/images/default.jpg';
  }
}
```

- [ ] **Step 6: Run tests**

```bash
cd /d/meloday && flutter test test/services/mock_agent_service_test.dart
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/services/mock_* test/services/
git commit -m "feat: add MockAgentService, MockMusicService, MockImageService"
```

---

### Task 6: Conversation provider (state machine)

**Files:**
- Create: `lib/features/chat/providers/conversation_provider.dart`
- Test: `test/features/chat/conversation_provider_test.dart`

- [ ] **Step 1: Write conversation provider test**

```dart
// test/features/chat/conversation_provider_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:meloday/features/chat/providers/conversation_provider.dart';
import 'package:meloday/models/conversation_state.dart';

void main() {
  group('ConversationProvider', () {
    test('initial state should be idle', () {
      final container = ProviderContainer();
      final state = container.read(conversationProvider);

      expect(state.status, ConvStatus.idle);
      expect(state.userMessages, isEmpty);
      expect(state.agentMessage, isNull);
    });

    test('startConversation should transition to greeting', () {
      final container = ProviderContainer();
      container.read(conversationProvider.notifier).startConversation();

      final state = container.read(conversationProvider);
      expect(state.status, ConvStatus.greeting);
      expect(state.agentMessage, isNotNull);
      expect(state.agentMessage!.sender, Sender.agent);
    });

    test('sendMessage in greeting should transition to chatting', () async {
      final container = ProviderContainer();
      container.read(conversationProvider.notifier).startConversation();

      await container.read(conversationProvider.notifier).sendMessage('今天吃了好吃的');

      final state = container.read(conversationProvider);
      expect(state.status, ConvStatus.chatting);
      expect(state.userMessages.length, 1);
    });
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /d/meloday && flutter test test/features/chat/conversation_provider_test.dart
```

Expected: FAIL.

- [ ] **Step 3: Create conversation provider**

```dart
// lib/features/chat/providers/conversation_provider.dart
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../models/chat_message.dart';
import '../../../models/conversation_state.dart';
import '../../../models/generating_progress.dart';
import '../../../models/music_card.dart';
import '../../../models/mood_colors.dart';
import '../../../services/mock_agent_service.dart';
import '../../../services/mock_music_service.dart';
import '../../../services/mock_image_service.dart';
import '../../../services/storage_service.dart';
import '../../../main.dart';

final mockAgentServiceProvider = Provider<MockAgentService>((ref) {
  return MockAgentService();
});

final mockMusicServiceProvider = Provider<MockMusicService>((ref) {
  return MockMusicService();
});

final mockImageServiceProvider = Provider<MockImageService>((ref) {
  return MockImageService();
});

final conversationProvider =
    StateNotifierProvider<ConversationNotifier, ConversationState>((ref) {
  return ConversationNotifier(
    agentService: ref.watch(mockAgentServiceProvider),
    musicService: ref.watch(mockMusicServiceProvider),
    imageService: ref.watch(mockImageServiceProvider),
    storageService: ref.watch(storageServiceProvider),
  );
});

class ConversationNotifier extends StateNotifier<ConversationState> {
  final MockAgentService _agentService;
  final MockMusicService _musicService;
  final MockImageService _imageService;
  final StorageService _storageService;
  final _uuid = const Uuid();

  ConversationNotifier({
    required MockAgentService agentService,
    required MockMusicService musicService,
    required MockImageService imageService,
    required StorageService storageService,
  })  : _agentService = agentService,
        _musicService = musicService,
        _imageService = imageService,
        _storageService = storageService,
        super(const ConversationState());

  void startConversation() {
    _agentService.reset();
    final greeting = _agentService.getGreeting();
    state = state.copyWith(
      status: ConvStatus.greeting,
      agentMessage: ChatMessage(
        id: _uuid.v4(),
        content: greeting,
        sender: Sender.agent,
        timestamp: DateTime.now(),
      ),
    );
  }

  Future<void> sendMessage(String content) async {
    final userMsg = ChatMessage(
      id: _uuid.v4(),
      content: content,
      sender: Sender.user,
      timestamp: DateTime.now(),
    );

    state = state.copyWith(
      status: ConvStatus.chatting,
      userMessages: [...state.userMessages, userMsg],
    );

    // Simulate agent thinking delay
    await Future.delayed(const Duration(milliseconds: 400));

    final agentRounds = state.userMessages.length; // rough estimate
    final shouldGenerate =
        _agentService.isInfoComplete(state.userMessages.length, agentRounds);

    if (shouldGenerate) {
      await _startGenerating();
    } else {
      final response = _agentService.getResponse(content);
      state = state.copyWith(
        agentMessage: ChatMessage(
          id: _uuid.v4(),
          content: response,
          sender: Sender.agent,
          timestamp: DateTime.now(),
        ),
      );
    }
  }

  Future<void> _startGenerating() async {
    state = state.copyWith(
      status: ConvStatus.generating,
      progress: const GeneratingProgress(
        currentStep: 1,
        totalSteps: 4,
        stepName: '分析心情',
      ),
      agentMessage: ChatMessage(
        id: _uuid.v4(),
        content: '我了解得差不多了，让我为你创作一首音乐吧 🎵',
        sender: Sender.agent,
        timestamp: DateTime.now(),
      ),
    );

    try {
      // Step 1 → 2
      await Future.delayed(const Duration(seconds: 1));
      state = state.copyWith(
        progress: const GeneratingProgress(
          currentStep: 2,
          totalSteps: 4,
          stepName: '编写提示词',
        ),
      );

      // Step 2 → 3
      await Future.delayed(const Duration(seconds: 1));
      state = state.copyWith(
        progress: const GeneratingProgress(
          currentStep: 3,
          totalSteps: 4,
          stepName: '生成音乐',
        ),
      );

      final userText = state.userMessages.map((m) => m.content).join(' ');
      final moodTags = _extractMoodTags(userText);

      // Generate music
      final musicPath = await _musicService.generateMusic(
        prompt: userText,
        mood: moodTags.first,
      );

      // Step 3 → 4
      state = state.copyWith(
        progress: const GeneratingProgress(
          currentStep: 4,
          totalSteps: 4,
          stepName: '匹配封面',
        ),
      );

      // Fetch image
      final imagePath = await _imageService.fetchImage(
        tags: moodTags,
        userMessages: userText,
      );

      await Future.delayed(const Duration(milliseconds: 500));

      // Create card
      final card = MusicCard(
        id: _uuid.v4(),
        name: _generateCardName(moodTags),
        summary: _generateSummary(userText),
        fullContent: _generateFullContent(userText),
        coverImage: imagePath,
        musicFile: musicPath,
        createdAt: DateTime.now(),
        tags: moodTags,
        moodColor: MoodColors.fromTags(moodTags),
      );

      // Save card
      await _storageService.saveCard(card);

      state = state.copyWith(
        status: ConvStatus.cardReady,
        clearProgress: true,
        currentCard: card,
        agentMessage: ChatMessage(
          id: _uuid.v4(),
          content: '✨ 今天的音乐日记已生成！',
          sender: Sender.agent,
          timestamp: DateTime.now(),
          type: MessageType.card,
          cardId: card.id,
        ),
      );
    } catch (e) {
      state = state.copyWith(
        status: ConvStatus.error,
        errorMessage: '创作失败了，让我再试一次好吗？',
        clearProgress: true,
      );
    }
  }

  void retryFromError() {
    state = state.copyWith(
      status: ConvStatus.chatting,
      clearError: true,
    );
  }

  void resetConversation() {
    _agentService.reset();
    state = const ConversationState();
    startConversation();
  }

  List<String> _extractMoodTags(String text) {
    final tags = <String>[];
    final lower = text.toLowerCase();
    if (lower.contains('妈妈') || lower.contains('家') || lower.contains('温暖')) {
      tags.add('温暖');
    }
    if (lower.contains('开心') || lower.contains('快乐') || lower.contains('高兴')) {
      tags.add('快乐');
    }
    if (lower.contains('怀念') || lower.contains('回忆') || lower.contains('以前')) {
      tags.add('怀旧');
    }
    if (lower.contains('安静') || lower.contains('平静') || lower.contains('放松')) {
      tags.add('平静');
    }
    if (lower.contains('难过') || lower.contains('伤感') || lower.contains('哭')) {
      tags.add('伤感');
    }
    if (tags.isEmpty) tags.add('温暖');
    return tags;
  }

  String _generateSummary(String userText) {
    if (userText.length <= 50) return userText;
    return '${userText.substring(0, 50)}...';
  }

  String _generateFullContent(String userText) {
    return userText;
  }

  String _generateCardName(List<String> tags) {
    if (tags.contains('温暖') && tags.contains('怀旧')) return '《温暖的回忆》';
    if (tags.contains('快乐')) return '《快乐的一天》';
    if (tags.contains('平静')) return '《宁静时光》';
    if (tags.contains('伤感')) return '《此刻心情》';
    return '《今日小记》';
  }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /d/meloday && flutter test test/features/chat/conversation_provider_test.dart
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/features/chat/providers/ test/features/chat/
git commit -m "feat: add ConversationProvider with full state machine"
```

---

### Task 7: Diary list provider

**Files:**
- Create: `lib/features/diary/providers/diary_list_provider.dart`

- [ ] **Step 1: Create diary list provider**

```dart
// lib/features/diary/providers/diary_list_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/music_card.dart';
import '../../../services/storage_service.dart';
import '../../../main.dart';

final diaryListProvider =
    StateNotifierProvider<DiaryListNotifier, AsyncValue<List<MusicCard>>>((ref) {
  return DiaryListNotifier(storageService: ref.watch(storageServiceProvider));
});

class DiaryListNotifier extends StateNotifier<AsyncValue<List<MusicCard>>> {
  final StorageService _storageService;

  DiaryListNotifier({required StorageService storageService})
      : _storageService = storageService,
        super(const AsyncValue.loading()) {
    loadCards();
  }

  Future<void> loadCards() async {
    state = const AsyncValue.loading();
    try {
      final cards = await _storageService.getAllCards();
      state = AsyncValue.data(cards);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> deleteCard(String id) async {
    await _storageService.deleteCard(id);
    await loadCards();
  }

  Future<void> renameCard(String id, String newName) async {
    await _storageService.updateCardName(id, newName);
    await loadCards();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/diary/
git commit -m "feat: add DiaryListProvider for timeline and card management"
```

---

### Task 8: Agent header widget

**Files:**
- Create: `lib/features/chat/widgets/agent_header.dart`

- [ ] **Step 1: Create AgentHeader widget**

```dart
// lib/features/chat/widgets/agent_header.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../models/chat_message.dart';
import '../../../core/theme.dart';

class AgentHeader extends StatelessWidget {
  final ChatMessage? message;

  const AgentHeader({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Agent avatar — circular glass container
          GlassContainer(
            width: 48,
            height: 48,
            borderRadius: BorderRadius.circular(24),
            blur: 10,
            border: Border.all(color: Colors.white.withOpacity(0.2)),
            child: const Center(
              child: Text('🤖', style: TextStyle(fontSize: 24)),
            ),
          ),
          const SizedBox(width: 12),
          // Agent message bubble
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: message != null
                  ? GlassContainer(
                      key: ValueKey(message!.id),
                      blur: 8,
                      borderRadius: BorderRadius.circular(16),
                      padding: const EdgeInsets.all(14),
                      child: Text(
                        message!.content,
                        style: const TextStyle(
                          color: AppTheme.textPrimary,
                          fontSize: 15,
                          height: 1.5,
                        ),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/chat/widgets/agent_header.dart
git commit -m "feat: add AgentHeader widget with glass morphism avatar and bubble"
```

---

### Task 9: User diary list widget

**Files:**
- Create: `lib/features/chat/widgets/user_diary_list.dart`

- [ ] **Step 1: Create UserDiaryList widget**

```dart
// lib/features/chat/widgets/user_diary_list.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../models/chat_message.dart';
import '../../../core/theme.dart';

class UserDiaryList extends StatelessWidget {
  final List<ChatMessage> messages;
  final ScrollController? scrollController;

  const UserDiaryList({
    super.key,
    required this.messages,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return const Center(
        child: Text(
          '写下今天的故事... ✍️',
          style: TextStyle(
            color: AppTheme.textSecondary,
            fontSize: 14,
          ),
        ),
      );
    }

    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final msg = messages[index];
        final timeStr = DateFormat('HH:mm').format(msg.timestamp);
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Align(
            alignment: Alignment.centerRight,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  timeStr,
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 11,
                  ),
                ),
                const SizedBox(height: 4),
                GlassContainer(
                  blur: 6,
                  borderRadius: BorderRadius.circular(16),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Text(
                    msg.content,
                    style: const TextStyle(
                      color: AppTheme.textPrimary,
                      fontSize: 14,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/chat/widgets/user_diary_list.dart
git commit -m "feat: add UserDiaryList widget — diary-style message list"
```

---

### Task 10: Chat input widget

**Files:**
- Create: `lib/features/chat/widgets/chat_input.dart`

- [ ] **Step 1: Create ChatInput widget**

```dart
// lib/features/chat/widgets/chat_input.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/theme.dart';

class ChatInput extends StatefulWidget {
  final bool enabled;
  final ValueChanged<String> onSend;

  const ChatInput({
    super.key,
    this.enabled = true,
    required this.onSend,
  });

  @override
  State<ChatInput> createState() => _ChatInputState();
}

class _ChatInputState extends State<ChatInput> {
  final _controller = TextEditingController();

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty || !widget.enabled) return;
    widget.onSend(text);
    _controller.clear();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: GlassContainer(
        blur: 10,
        borderRadius: BorderRadius.circular(24),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _controller,
                enabled: widget.enabled,
                style: const TextStyle(color: AppTheme.textPrimary, fontSize: 14),
                decoration: const InputDecoration(
                  hintText: '💬 分享今天的点滴...',
                  hintStyle: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(vertical: 12),
                ),
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _handleSend(),
              ),
            ),
            IconButton(
              icon: Icon(
                Icons.send_rounded,
                color: widget.enabled
                    ? AppTheme.accent
                    : AppTheme.textSecondary,
              ),
              onPressed: widget.enabled ? _handleSend : null,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/chat/widgets/chat_input.dart
git commit -m "feat: add ChatInput widget with glass morphism input bar"
```

---

### Task 11: Generating progress widget

**Files:**
- Create: `lib/features/chat/widgets/generating_progress.dart`

- [ ] **Step 1: Create GeneratingProgressWidget**

```dart
// lib/features/chat/widgets/generating_progress.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../models/generating_progress.dart';
import '../../../core/theme.dart';

class GeneratingProgressWidget extends StatelessWidget {
  final GeneratingProgress progress;

  const GeneratingProgressWidget({super.key, required this.progress});

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      blur: 8,
      borderRadius: BorderRadius.circular(16),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Text('🎵', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Text(
                '正在为你创作...',
                style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 14,
                ),
              ),
              const Spacer(),
              Text(
                '${progress.currentStep}/${progress.totalSteps}',
                style: const TextStyle(
                  color: AppTheme.textSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            progress.stepName,
            style: const TextStyle(
              color: AppTheme.accent,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress.percent,
              backgroundColor: Colors.white.withOpacity(0.1),
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accent),
              minHeight: 4,
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/chat/widgets/generating_progress.dart
git commit -m "feat: add GeneratingProgressWidget with step-by-step progress bar"
```

---

### Task 12: Music player widget

**Files:**
- Create: `lib/features/card/widgets/music_player.dart`

- [ ] **Step 1: Create MusicPlayer widget**

```dart
// lib/features/card/widgets/music_player.dart
import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/theme.dart';

class MusicPlayer extends StatefulWidget {
  final String musicPath;

  const MusicPlayer({super.key, required this.musicPath});

  @override
  State<MusicPlayer> createState() => _MusicPlayerState();
}

class _MusicPlayerState extends State<MusicPlayer> {
  final _player = AudioPlayer();
  PlayerState _playerState = PlayerState.stopped;
  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;

  @override
  void initState() {
    super.initState();
    _setupPlayer();
  }

  Future<void> _setupPlayer() async {
    _player.onPlayerStateChanged.listen((state) {
      if (mounted) setState(() => _playerState = state);
    });
    _player.onDurationChanged.listen((d) {
      if (mounted) setState(() => _duration = d);
    });
    _player.onPositionChanged.listen((p) {
      if (mounted) setState(() => _position = p);
    });
  }

  Future<void> _togglePlay() async {
    if (_playerState == PlayerState.playing) {
      await _player.pause();
    } else {
      await _player.play(AssetSource(widget.musicPath.replaceFirst('assets/', '')));
    }
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isPlaying = _playerState == PlayerState.playing;

    return GlassContainer(
      blur: 8,
      borderRadius: BorderRadius.circular(16),
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Progress bar
          SliderTheme(
            data: SliderThemeData(
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
              activeTrackColor: AppTheme.accent,
              inactiveTrackColor: Colors.white.withOpacity(0.1),
              thumbColor: AppTheme.accent,
            ),
            child: Slider(
              value: _position.inMilliseconds.toDouble().clamp(
                0,
                _duration.inMilliseconds.toDouble(),
              ),
              max: _duration.inMilliseconds.toDouble().clamp(1, double.infinity),
              onChanged: (value) {
                _player.seek(Duration(milliseconds: value.toInt()));
              },
            ),
          ),
          const SizedBox(height: 8),
          // Time labels
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatDuration(_position),
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
              ),
              Text(
                _formatDuration(_duration),
                style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Play/Pause button
          GestureDetector(
            onTap: _togglePlay,
            child: GlassContainer(
              width: 56,
              height: 56,
              borderRadius: BorderRadius.circular(28),
              blur: 10,
              child: Center(
                child: Icon(
                  isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: AppTheme.textPrimary,
                  size: 32,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/card/widgets/music_player.dart
git commit -m "feat: add MusicPlayer widget with glass morphism controls"
```

---

### Task 13: Music card compact widget

**Files:**
- Create: `lib/features/card/widgets/music_card_compact.dart`

- [ ] **Step 1: Create MusicCardCompact widget**

```dart
// lib/features/card/widgets/music_card_compact.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../models/music_card.dart';
import '../../../core/theme.dart';

class MusicCardCompact extends StatelessWidget {
  final MusicCard card;
  final VoidCallback? onTap;

  const MusicCardCompact({
    super.key,
    required this.card,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final moodColor = AppTheme.moodColorFromHex(card.moodColor);

    return GestureDetector(
      onTap: onTap,
      child: GlassContainer(
        blur: 8,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: moodColor.withOpacity(0.3),
          width: 1,
        ),
        child: Row(
          children: [
            // Cover thumbnail
            ClipRRect(
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                bottomLeft: Radius.circular(16),
              ),
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: moodColor.withOpacity(0.3),
                ),
                child: Center(
                  child: Icon(
                    Icons.music_note_rounded,
                    color: moodColor,
                    size: 32,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            // Card name
            Expanded(
              child: Text(
                card.name,
                style: const TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.chevron_right,
              color: AppTheme.textSecondary,
              size: 20,
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/card/widgets/music_card_compact.dart
git commit -m "feat: add MusicCardCompact widget for timeline list"
```

---

### Task 14: Home page

**Files:**
- Create: `lib/features/chat/pages/home_page.dart`

- [ ] **Step 1: Create HomePage**

```dart
// lib/features/chat/pages/home_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/conversation_provider.dart';
import '../widgets/agent_header.dart';
import '../widgets/user_diary_list.dart';
import '../widgets/chat_input.dart';
import '../widgets/generating_progress.dart';
import '../../card/widgets/music_card_compact.dart';
import '../../../models/conversation_state.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    // Start conversation when home page first loads
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = ref.read(conversationProvider);
      if (state.status == ConvStatus.idle) {
        ref.read(conversationProvider.notifier).startConversation();
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _handleSend(String text) async {
    await ref.read(conversationProvider.notifier).sendMessage(text);
    _scrollToBottom();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(conversationProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: Column(
          children: [
            // Top: Agent area
            _buildAgentArea(state),
            const Divider(
              color: Color(0xFF2A2A4E),
              height: 1,
              indent: 48,
              endIndent: 16,
            ),
            // Middle: User diary list
            Expanded(child: UserDiaryList(
              messages: state.userMessages,
              scrollController: _scrollController,
            )),
            // Bottom: Input area
            ChatInput(
              enabled: state.status != ConvStatus.generating,
              onSend: _handleSend,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAgentArea(ConversationState state) {
    switch (state.status) {
      case ConvStatus.generating:
        return Column(
          children: [
            const AgentHeader(message: null),
            if (state.progress != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 64),
                child: GeneratingProgressWidget(progress: state.progress!),
              ),
          ],
        );
      case ConvStatus.cardReady:
        return Column(
          children: [
            AgentHeader(message: state.agentMessage),
            if (state.currentCard != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 64),
                child: Column(
                  children: [
                    const SizedBox(height: 4),
                    MusicCardCompact(
                      card: state.currentCard!,
                      onTap: () {
                        Navigator.of(context).pushNamed(
                          '/card',
                          arguments: state.currentCard!.id,
                        );
                      },
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
          ],
        );
      case ConvStatus.error:
        return AgentHeader(
          message: state.agentMessage,
        );
      default:
        return AgentHeader(message: state.agentMessage);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/chat/pages/
git commit -m "feat: add HomePage — agent header + user diary list + chat input"
```

---

### Task 15: Card detail page

**Files:**
- Create: `lib/features/card/pages/card_detail_page.dart`
- Create: `lib/features/card/providers/music_card_provider.dart`

- [ ] **Step 1: Create music card provider**

```dart
// lib/features/card/providers/music_card_provider.dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/music_card.dart';
import '../../../services/storage_service.dart';
import '../../../main.dart';

final musicCardProvider =
    FutureProvider.family<MusicCard?, String>((ref, cardId) async {
  final storage = ref.watch(storageServiceProvider);
  return storage.getCard(cardId);
});
```

- [ ] **Step 2: Create CardDetailPage**

```dart
// lib/features/card/pages/card_detail_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../providers/music_card_provider.dart';
import '../widgets/music_player.dart';
import '../../../core/theme.dart';

class CardDetailPage extends ConsumerWidget {
  final String cardId;

  const CardDetailPage({super.key, required this.cardId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardAsync = ref.watch(musicCardProvider(cardId));

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit_outlined, size: 20),
            onPressed: () => _showRenameDialog(context, ref, cardAsync.value),
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, size: 20),
            onPressed: () => _confirmDelete(context, ref),
          ),
        ],
      ),
      body: cardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('加载失败: $e')),
        data: (card) {
          if (card == null) {
            return const Center(child: Text('卡片不存在'));
          }
          return _buildCardContent(context, ref, card);
        },
      ),
    );
  }

  Widget _buildCardContent(BuildContext context, WidgetRef ref, MusicCard card) {
    final moodColor = AppTheme.moodColorFromHex(card.moodColor);
    final dateStr = DateFormat('yyyy年M月d日').format(card.createdAt);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Cover image area
          GlassContainer(
            blur: 12,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: moodColor.withOpacity(0.4)),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: Container(
                height: 200,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      moodColor.withOpacity(0.6),
                      moodColor.withOpacity(0.2),
                    ],
                  ),
                ),
                child: Center(
                  child: Icon(
                    Icons.music_note_rounded,
                    size: 72,
                    color: moodColor.withOpacity(0.8),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Card name
          Text(
            card.name,
            style: const TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          // Date
          Text(
            dateStr,
            style: const TextStyle(
              color: AppTheme.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 20),
          // Summary
          Text(
            card.summary,
            style: const TextStyle(
              color: AppTheme.textPrimary,
              fontSize: 16,
              height: 1.6,
            ),
          ),
          const SizedBox(height: 16),
          // View full diary button
          GestureDetector(
            onTap: () => _showFullDiary(context, card),
            child: GlassContainer(
              blur: 6,
              borderRadius: BorderRadius.circular(12),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('📖', style: TextStyle(fontSize: 16)),
                  SizedBox(width: 8),
                  Text(
                    '查看完整日记',
                    style: TextStyle(
                      color: AppTheme.accent,
                      fontSize: 14,
                    ),
                  ),
                  SizedBox(width: 4),
                  Icon(Icons.chevron_right, color: AppTheme.accent, size: 18),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Music player
          MusicPlayer(musicPath: card.musicFile),
          const SizedBox(height: 24),
          // Tags
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: card.tags.map((tag) => _buildTag(tag, moodColor)).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildTag(String tag, Color color) {
    return GlassContainer(
      blur: 4,
      borderRadius: BorderRadius.circular(12),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      border: Border.all(color: color.withOpacity(0.3)),
      child: Text(
        '#$tag',
        style: TextStyle(color: color, fontSize: 12),
      ),
    );
  }

  void _showFullDiary(BuildContext context, MusicCard card) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => GlassContainer(
        blur: 16,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(24),
          topRight: Radius.circular(24),
        ),
        margin: const EdgeInsets.all(12),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              '📖 完整日记',
              style: TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              card.fullContent,
              style: const TextStyle(
                color: AppTheme.textPrimary,
                fontSize: 15,
                height: 1.8,
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  void _showRenameDialog(BuildContext context, WidgetRef ref, MusicCard? card) {
    if (card == null) return;
    final controller = TextEditingController(text: card.name);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('重命名卡片', style: TextStyle(color: AppTheme.textPrimary)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: const TextStyle(color: AppTheme.textPrimary),
          decoration: const InputDecoration(
            hintText: '输入新名字',
            hintStyle: TextStyle(color: AppTheme.textSecondary),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              ref.read(diaryListProvider.notifier).renameCard(card.id, controller.text);
              Navigator.pop(context);
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('删除日记', style: TextStyle(color: AppTheme.textPrimary)),
        content: const Text(
          '确定要删除这张音乐日记吗？',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              ref.read(diaryListProvider.notifier).deleteCard(cardId);
              Navigator.pop(context); // close dialog
              Navigator.pop(context); // go back
            },
            child: const Text('删除', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
  }
}
```

> **Import note:** `CardDetailPage` references `diaryListProvider` — add the import at the top:
> ```dart
> import '../../diary/providers/diary_list_provider.dart';
> ```
> and add `import '../../../models/music_card.dart';` for the MusicCard type.

- [ ] **Step 2: Commit**

```bash
git add lib/features/card/
git commit -m "feat: add CardDetailPage with full diary viewer, rename, delete"
```

---

### Task 16: Timeline list widget

**Files:**
- Create: `lib/features/diary/widgets/timeline_list.dart`

- [ ] **Step 1: Create TimelineList widget**

```dart
// lib/features/diary/widgets/timeline_list.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../models/music_card.dart';
import '../../card/widgets/music_card_compact.dart';
import '../../../core/theme.dart';

class TimelineList extends StatelessWidget {
  final List<MusicCard> cards;
  final void Function(String cardId) onCardTap;
  final void Function(String cardId) onDelete;

  const TimelineList({
    super.key,
    required this.cards,
    required this.onCardTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('📔', style: TextStyle(fontSize: 48)),
            SizedBox(height: 16),
            Text(
              '还没有日记',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 16),
            ),
            SizedBox(height: 8),
            Text(
              '去首页写一篇吧 ✨',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 14),
            ),
          ],
        ),
      );
    }

    // Group cards by date
    final grouped = <String, List<MusicCard>>{};
    for (final card in cards) {
      final key = DateFormat('yyyy-MM-dd').format(card.createdAt);
      grouped.putIfAbsent(key, () => []).add(card);
    }

    final entries = grouped.entries.toList();

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      itemCount: entries.length,
      itemBuilder: (context, index) {
        final entry = entries.elementAt(index);
        final date = DateTime.parse(entry.key);
        final dayCards = entry.value;
        final isToday = DateFormat('yyyy-MM-dd').format(DateTime.now()) == entry.key;
        final dateLabel = isToday
            ? '今天'
            : DateFormat('M月d日').format(date);
        final moodColor = dayCards.first.moodColor;

        return _buildDateGroup(
          dateLabel: dateLabel,
          isToday: isToday,
          moodColor: moodColor,
          cards: dayCards,
          isLast: index == entries.length - 1,
        );
      },
    );
  }

  Widget _buildDateGroup({
    required String dateLabel,
    required bool isToday,
    required String moodColor,
    required List<MusicCard> cards,
    required bool isLast,
  }) {
    final color = AppTheme.moodColorFromHex(moodColor);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline line
          SizedBox(
            width: 48,
            child: Column(
              children: [
                // Dot
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: color.withOpacity(0.5),
                      width: 2,
                    ),
                  ),
                ),
                // Line
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1,
                      color: Colors.white.withOpacity(0.1),
                    ),
                  ),
              ],
            ),
          ),
          // Content
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 8, top: 2),
                  child: Text(
                    dateLabel,
                    style: TextStyle(
                      color: isToday ? color : AppTheme.textSecondary,
                      fontSize: 14,
                      fontWeight: isToday ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ),
                ...cards.map((card) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Dismissible(
                    key: Key(card.id),
                    direction: DismissDirection.endToStart,
                    background: Container(
                      alignment: Alignment.centerRight,
                      padding: const EdgeInsets.only(right: 20),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(Icons.delete_outline, color: Colors.redAccent),
                    ),
                    onDismissed: (_) => onDelete(card.id),
                    child: MusicCardCompact(
                      card: card,
                      onTap: () => onCardTap(card.id),
                    ),
                  ),
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/diary/widgets/
git commit -m "feat: add TimelineList widget with date grouping and swipe-to-delete"
```

---

### Task 17: Diary page

**Files:**
- Create: `lib/features/diary/pages/diary_page.dart`

- [ ] **Step 1: Create DiaryPage**

```dart
// lib/features/diary/pages/diary_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/diary_list_provider.dart';
import '../widgets/timeline_list.dart';

class DiaryPage extends ConsumerWidget {
  const DiaryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diaryState = ref.watch(diaryListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: diaryState.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('加载失败', style: TextStyle(color: Colors.white70)),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => ref.read(diaryListProvider.notifier).loadCards(),
                  child: const Text('重试'),
                ),
              ],
            ),
          ),
          data: (cards) => TimelineList(
            cards: cards,
            onCardTap: (cardId) {
              Navigator.of(context).pushNamed('/card', arguments: cardId);
            },
            onDelete: (cardId) {
              ref.read(diaryListProvider.notifier).deleteCard(cardId);
            },
          ),
        ),
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/diary/pages/
git commit -m "feat: add DiaryPage with timeline and empty state"
```

---

### Task 18: Profile page

**Files:**
- Create: `lib/features/profile/pages/profile_page.dart`

- [ ] **Step 1: Create ProfilePage**

```dart
// lib/features/profile/pages/profile_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/theme.dart';
import '../../diary/providers/diary_list_provider.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final diaryState = ref.watch(diaryListProvider);
    final totalCount = diaryState.whenOrNull(data: (cards) => cards.length) ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 32),
              // Avatar
              GlassContainer(
                width: 80,
                height: 80,
                borderRadius: BorderRadius.circular(40),
                blur: 12,
                child: const Center(
                  child: Text('👤', style: TextStyle(fontSize: 36)),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Finjix 的音乐日记',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 32),
              // Stats cards
              Row(
                children: [
                  _buildStatCard('$totalCount', '日记'),
                  const SizedBox(width: 12),
                  _buildStatCard('$totalCount', '本月'),
                  const SizedBox(width: 12),
                  _buildStatCard('$totalCount', '连续'),
                ],
              ),
              const SizedBox(height: 48),
              // Menu items
              _buildMenuItem(Icons.settings_outlined, '设置'),
              const SizedBox(height: 8),
              _buildMenuItem(Icons.info_outline, '关于 Meloday'),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatCard(String value, String label) {
    return Expanded(
      child: GlassContainer(
        blur: 8,
        borderRadius: BorderRadius.circular(16),
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: AppTheme.accent,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMenuItem(IconData icon, String title) {
    return GlassContainer(
      blur: 6,
      borderRadius: BorderRadius.circular(12),
      child: ListTile(
        leading: Icon(icon, color: AppTheme.textSecondary),
        title: Text(title, style: const TextStyle(color: AppTheme.textPrimary)),
        trailing: const Icon(Icons.chevron_right, color: AppTheme.textSecondary),
        onTap: () {
          // Mock — settings and about not implemented in MVP
        },
      ),
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/features/profile/
git commit -m "feat: add ProfilePage with stats and menu"
```

---

### Task 19: App shell with bottom navigation

**Files:**
- Modify: `lib/app.dart`

- [ ] **Step 1: Update AppShell with IndexedStack and glass navigation**

```dart
// lib/app.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'core/theme.dart';
import 'features/chat/pages/home_page.dart';
import 'features/diary/pages/diary_page.dart';
import 'features/profile/pages/profile_page.dart';
import 'features/card/pages/card_detail_page.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

  final _pages = const [
    HomePage(),
    DiaryPage(),
    ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 12),
        child: GlassContainer(
          blur: 16,
          borderRadius: BorderRadius.circular(28),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(Icons.home_rounded, 0),
              _buildNavItem(Icons.book_rounded, 1),
              _buildNavItem(Icons.person_rounded, 2),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, int index) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () => setState(() => _currentIndex = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.accent.withOpacity(0.2) : Colors.transparent,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Icon(
          icon,
          color: isSelected ? AppTheme.accent : AppTheme.textSecondary,
          size: 24,
        ),
      ),
    );
  }
}
```

> **Important:** `main.dart` must set up routing to handle `/card` → `CardDetailPage`. The `MaterialApp` in `main.dart` needs `onGenerateRoute`:

- [ ] **Step 2: Update main.dart to add routing**

```dart
// lib/main.dart — replace the MainApp class with:
class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Meloday',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF1A1A2E),
      ),
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
}
```

> Also add the import at the top of `main.dart`:
> ```dart
> import 'features/card/pages/card_detail_page.dart';
> ```

- [ ] **Step 3: Commit**

```bash
git add lib/main.dart lib/app.dart
git commit -m "feat: add AppShell with glass bottom nav capsule and routing"
```

---

### Task 20: Assets — images and test music

**Files:**
- Create: `assets/images/.gitkeep` (remove later)
- Create: `assets/music/.gitkeep` (remove later)
- Modify: `pubspec.yaml` (already has assets configured from Task 1)

- [ ] **Step 1: Prepare placeholder asset structure**

For MVP, the app runs with gradient/color placeholders for images and an empty audio file for music. The UI widgets already handle missing assets gracefully by showing gradient backgrounds.

Create a minimal placeholder audio file:

```bash
# Generate a short silent MP3 (or download a free test tone)
# For now, audio will simply fail gracefully — the player handles asset-not-found
```

- [ ] **Step 2: Verify asset references in pubspec.yaml**

Ensure `pubspec.yaml` has:
```yaml
flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/music/
```

- [ ] **Step 3: Add a test MP3 file**

Place any short MP3 file at `assets/music/test.mp3`. For MVP, this can be a downloaded royalty-free track or a generated silent file.

- [ ] **Step 4: Commit**

```bash
git add assets/
git commit -m "feat: add asset directories and placeholder files"
```

---

### Task 21: Wire up and verify

- [ ] **Step 1: Run the app**

```bash
cd /d/meloday && flutter run -d chrome
```

Expected: App launches in Chrome, shows glass morphism UI with three tabs.

- [ ] **Step 2: Smoke test the conversation flow**

Manual verification:
1. App opens → Agent greets
2. Type message → Agent responds
3. After 3+ rounds → Agent auto-generates card
4. Card appears → can navigate to detail page
5. Detail page shows full diary, player, tags
6. Diary tab shows cards in timeline
7. Profile tab shows stats

- [ ] **Step 3: Run all tests**

```bash
cd /d/meloday && flutter test
```

Expected: All tests pass.

- [ ] **Step 4: Fix any issues, then commit**

```bash
git add -A
git commit -m "feat: wire up MVP — full conversation flow to card generation"
```
