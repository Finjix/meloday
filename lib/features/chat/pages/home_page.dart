// lib/features/chat/pages/home_page.dart
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/conversation_state.dart';
import '../../../models/chat_message.dart';
import '../providers/conversation_provider.dart';
import '../widgets/agent_header.dart';
import '../widgets/generating_progress.dart';
import '../widgets/diary_text.dart';
import '../../card/widgets/music_card_compact.dart';
import '../../../core/glass_config.dart';
import '../../../core/theme.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final _scrollController = ScrollController();

  static const _weekDays = [
    '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'
  ];

  /// Number of leading non-message items in the ListView
  /// (spacer at index 0, diary header at index 1).
  static const _leadingItemCount = 2;

  /// Header animation time: weekday (750) + date (750) + divider delay (1500)
  /// + divider fade (500) ≈ 2000 ms.
  static const int _headerAnimMs = 2000;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = ref.read(conversationProvider);
      if (state.status == ConvStatus.idle) {
        ref.read(conversationProvider.notifier).startConversation();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
  }

  void _handleRetry() {
    ref.read(conversationProvider.notifier).retryFromError();
  }

  /// Estimate how long a message's reveal animation will take (ms).
  int _estMessageMs(String text) {
    // Rough estimate: ~20 CJK chars or ~30 Latin chars per line.
    final estimatedLines = (text.length / 20).ceil().clamp(1, 100);
    return estimatedLines * 650 + 150;
  }

  /// Cumulative delay for a message at [msgIndex], so each message starts
  /// only after every previous one has finished.
  Duration _msgDelay(List<ChatMessage> messages, int msgIndex) {
    int total = _headerAnimMs;
    for (int i = 0; i < msgIndex; i++) {
      total += _estMessageMs(messages[i].content);
    }
    return Duration(milliseconds: total);
  }

  Widget _buildAgentArea(ConversationState state) {
    switch (state.status) {
      case ConvStatus.idle:
        return const SizedBox.shrink();
      case ConvStatus.greeting:
      case ConvStatus.chatting:
        return AgentHeader(message: state.agentMessage);
      case ConvStatus.generating:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (state.agentMessage != null)
              AgentHeader(message: state.agentMessage),
            if (state.progress != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: GeneratingProgressWidget(progress: state.progress!),
              ),
          ],
        );
      case ConvStatus.cardReady:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (state.currentCard != null)
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                child: MusicCardCompact(
                  card: state.currentCard!,
                  onTap: () => Navigator.of(context).pushNamed(
                    '/card',
                    arguments: state.currentCard!.id,
                  ),
                ),
              ),
            if (state.agentMessage != null)
              AgentHeader(message: state.agentMessage),
          ],
        );
      case ConvStatus.error:
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (state.agentMessage != null)
              AgentHeader(message: state.agentMessage),
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: [
                  Icon(Icons.error_outline,
                      color: Theme.of(context).colorScheme.primary,
                      size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      state.errorMessage ?? '出了点问题',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: _handleRetry,
                    child: Text('重试',
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.primary,
                            fontSize: 14)),
                  ),
                ],
              ),
            ),
          ],
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(conversationProvider, (prev, next) {
      final prevLen = prev?.userMessages.length ?? 0;
      if (next.userMessages.length > prevLen) {
        WidgetsBinding.instance
            .addPostFrameCallback((_) => _scrollToBottom());
      }
    });

    final state = ref.watch(conversationProvider);
    final theme = Theme.of(context);
    final bgColor = theme.scaffoldBackgroundColor;
    final textColor = theme.colorScheme.onSurface;

    /// Show the diary area only after the user first taps the compose FAB.
    final showDiary = state.hasExpandedInput;
    final agentArea = _buildAgentArea(state);

    // Timestamp for the diary header — uses the first message's time,
    // or falls back to now when no messages have been sent yet.
    final headerTimestamp =
        state.userMessages.isNotEmpty
            ? state.userMessages.first.timestamp
            : DateTime.now();

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            // ── Scrollable diary content (behind agent header) ──
            if (showDiary)
              ScrollConfiguration(
                behavior: ScrollConfiguration.of(context).copyWith(
                  dragDevices: {
                    PointerDeviceKind.touch,
                    PointerDeviceKind.mouse,
                    PointerDeviceKind.trackpad,
                    PointerDeviceKind.stylus,
                  },
                ),
                child: ScrollbarTheme(
                  data: const ScrollbarThemeData(
                    thickness: WidgetStatePropertyAll(0),
                  ),
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: EdgeInsets.zero,
                    itemCount:
                        state.userMessages.length + _leadingItemCount,
                    itemBuilder: (context, index) {
                      // Transparent spacer matching agent area height
                      if (index == 0) {
                        return Opacity(
                          opacity: 0,
                          child: IgnorePointer(child: agentArea),
                        );
                      }
                      if (index == 1) {
                        return _buildDiaryHeader(context, headerTimestamp);
                      }

                      final msg =
                          state.userMessages[index - _leadingItemCount];
                      final msgIndex = index - _leadingItemCount;
                      final delay =
                          _msgDelay(state.userMessages, msgIndex);

                      return Padding(
                        padding: const EdgeInsets.only(
                            bottom: 16, left: 32, right: 32),
                        child: DiaryText(
                          msg.content,
                          key: ValueKey(msg.id),
                          delay: delay,
                          style: TextStyle(
                            color: textColor,
                            fontSize: 17,
                            height: 1.8,
                            fontFamily: AppTheme.diaryFontFamily,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

            // ── Top gradient fade — content fades before agent header ──
            if (showDiary)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: GlassConfig.topFadeHeight,
                child: IgnorePointer(
                  child: RepaintBoundary(
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            bgColor,
                            bgColor.withValues(alpha: 0),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),

            // ── Agent header overlay (glass effect shows content through) ──
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: agentArea,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDiaryHeader(BuildContext context, DateTime timestamp) {
    final weekday = _weekDays[timestamp.weekday - 1];
    final dateStr = '${timestamp.month}月${timestamp.day}日';

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
      child: Column(
        children: [
          DiaryText(
            weekday,
            key: ValueKey('weekday_$weekday'),
            style: TextStyle(
              color: Theme.of(context)
                  .colorScheme
                  .onSurfaceVariant
                  .withValues(alpha: 0.5),
              fontSize: 13,
              fontFamily: AppTheme.diaryFontFamily,
            ),
          ),
          const SizedBox(height: 4),
          DiaryText(
            dateStr,
            key: ValueKey('date_$dateStr'),
            delay: const Duration(milliseconds: 750),
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 22,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.diaryFontFamily,
            ),
          ),
          const SizedBox(height: 10),
          _FadeInDivider(
            delay: const Duration(milliseconds: 1500),
            child: Container(
              width: 32,
              height: 2,
              decoration: BoxDecoration(
                color: Theme.of(context)
                    .colorScheme
                    .onSurfaceVariant
                    .withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Fade-in helper — reveals its child with a soft opacity animation after a delay.
// ──────────────────────────────────────────────────────────────────────────────
class _FadeInDivider extends StatefulWidget {
  final Widget child;
  final Duration delay;

  const _FadeInDivider({required this.child, required this.delay});

  @override
  State<_FadeInDivider> createState() => _FadeInDividerState();
}

class _FadeInDividerState extends State<_FadeInDivider>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    Future.delayed(widget.delay, () {
      if (mounted) _ctrl.forward();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(opacity: _ctrl, child: widget.child);
  }
}
