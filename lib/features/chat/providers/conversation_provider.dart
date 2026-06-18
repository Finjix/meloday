// ignore_for_file: prefer_initializing_formals

import 'dart:async';
import 'package:characters/characters.dart';
import 'package:flutter/foundation.dart';
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
import '../../diary/providers/diary_list_provider.dart';

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
    onCardCreated: () => ref.read(diaryListProvider.notifier).loadCards(),
  );
});

class ConversationNotifier extends StateNotifier<ConversationState> {
  final MockAgentService _agentService;
  final MockMusicService _musicService;
  final MockImageService _imageService;
  final StorageService _storageService;
  final void Function()? _onCardCreated;
  final _uuid = const Uuid();

  /// Whether this notifier is still active. Set to false in [dispose].
  bool _active = true;

  ConversationNotifier({
    required MockAgentService agentService,
    required MockMusicService musicService,
    required MockImageService imageService,
    required StorageService storageService,
    void Function()? onCardCreated,
  })  : _agentService = agentService,
        _musicService = musicService,
        _imageService = imageService,
        _storageService = storageService,
        _onCardCreated = onCardCreated,
        super(const ConversationState());

  @override
  void dispose() {
    _active = false;
    super.dispose();
  }

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

  /// Called when the user first taps the compose FAB.
  void markInputExpanded() {
    if (!state.hasExpandedInput) {
      state = state.copyWith(hasExpandedInput: true);
    }
  }

  Future<void> sendMessage(String content) async {
    // Guard against re-entrancy during generation
    if (state.status == ConvStatus.generating) return;

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

    // Guard against state mutation after dispose
    if (!_active) return;

    // Use the agent's internal round counter, not user message count
    final shouldGenerate = _agentService.isInfoComplete(
      state.userMessages.length,
      _agentService.agentRounds,
    );

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
    final totalSteps = GeneratingProgress.stepNames.length;

    state = state.copyWith(
      status: ConvStatus.generating,
      progress: GeneratingProgress(
        currentStep: 1,
        totalSteps: totalSteps,
        stepName: GeneratingProgress.stepNames[0],
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
      if (!_active) return;
      state = state.copyWith(
        progress: GeneratingProgress(
          currentStep: 2,
          totalSteps: totalSteps,
          stepName: GeneratingProgress.stepNames[1],
        ),
      );

      // Step 2 → 3
      await Future.delayed(const Duration(seconds: 1));
      if (!_active) return;
      state = state.copyWith(
        progress: GeneratingProgress(
          currentStep: 3,
          totalSteps: totalSteps,
          stepName: GeneratingProgress.stepNames[2],
        ),
      );

      final userText = state.userMessages.map((m) => m.content).join(' ');
      final moodTags = _extractMoodTags(userText);

      // Generate music
      final musicPath = await _musicService.generateMusic(
        prompt: userText,
        mood: moodTags.first,
      );
      if (!_active) return;

      // Step 3 → 4
      state = state.copyWith(
        progress: GeneratingProgress(
          currentStep: 4,
          totalSteps: totalSteps,
          stepName: GeneratingProgress.stepNames[3],
        ),
      );

      // Fetch image
      final imagePath = await _imageService.fetchImage(
        tags: moodTags,
        userMessages: userText,
      );
      if (!_active) return;

      await Future.delayed(const Duration(milliseconds: 500));
      if (!_active) return;

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
      if (!_active) return;

      // Notify listeners so diary list refreshes
      _onCardCreated?.call();

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
    } catch (e, st) {
      debugPrint('Meloday: card generation failed: $e\n$st');
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
    final chars = userText.characters;
    if (chars.length <= 50) return userText;
    return '${chars.take(50)}...';
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
