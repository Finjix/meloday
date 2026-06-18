// lib/features/chat/pages/home_page.dart
import 'package:flutter/material.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/conversation_state.dart';
import '../providers/conversation_provider.dart';
import '../widgets/agent_header.dart';
import '../widgets/generating_progress.dart';
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
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
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
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                children: [
                  Icon(Icons.error_outline,
                      color: Theme.of(context).colorScheme.primary, size: 20),
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
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
      }
    });

    final state = ref.watch(conversationProvider);
    final theme = Theme.of(context);
    final bgColor = theme.scaffoldBackgroundColor;
    final textColor = theme.colorScheme.onSurface;

    final hasMessages = state.userMessages.isNotEmpty;
    final agentArea = _buildAgentArea(state);

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            // ── Scrollable diary content (behind agent header) ──
            if (hasMessages)
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
                        return _buildDiaryHeader(
                            context, state.userMessages.first.timestamp);
                      }
                      final msg =
                          state.userMessages[index - _leadingItemCount];
                      return Padding(
                        padding: const EdgeInsets.only(
                            bottom: 16, left: 32, right: 32),
                        child: Text(
                          msg.content,
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
            if (hasMessages)
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
          Text(
            weekday,
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
          Text(
            dateStr,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 22,
              fontWeight: FontWeight.w500,
              fontFamily: AppTheme.diaryFontFamily,
            ),
          ),
          const SizedBox(height: 10),
          Container(
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
        ],
      ),
    );
  }
}
