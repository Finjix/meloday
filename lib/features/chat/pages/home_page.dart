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

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final _scrollController = ScrollController();
  int _lastMessageCount = 0;

  static const _weekDays = [
    '星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'
  ];

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
    final state = ref.watch(conversationProvider);

    if (state.status == ConvStatus.idle) {
      _lastMessageCount = 0;
    }

    if (state.userMessages.length > _lastMessageCount) {
      _lastMessageCount = state.userMessages.length;
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    }

    final showDivider = state.userMessages.isNotEmpty;

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            // ── Scrollable diary content (behind agent header) ──
            if (showDivider)
              ScrollConfiguration(
                behavior: ScrollConfiguration.of(context).copyWith(
                  dragDevices: {
                    PointerDeviceKind.touch,
                    PointerDeviceKind.mouse,
                    PointerDeviceKind.trackpad,
                  },
                ),
                child: ScrollbarTheme(
                  data: const ScrollbarThemeData(
                    thickness: WidgetStatePropertyAll(0),
                  ),
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: EdgeInsets.zero,
                    itemCount: state.userMessages.length + 2,
                    itemBuilder: (context, index) {
                      // Transparent spacer matching agent area height
                      if (index == 0) {
                        return Opacity(
                          opacity: 0,
                          child: IgnorePointer(
                            child: _buildAgentArea(state),
                          ),
                        );
                      }
                      if (index == 1) {
                        return _buildDiaryHeader(
                            context, state.userMessages.first.timestamp);
                      }
                      final msg = state.userMessages[index - 2];
                      return Padding(
                        padding: const EdgeInsets.only(
                            bottom: 16, left: 32, right: 32),
                        child: Text(
                          msg.content,
                          style: TextStyle(
                            color:
                                Theme.of(context).colorScheme.onSurface,
                            fontSize: 17,
                            height: 1.8,
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

            // ── Top gradient fade — content fades before agent header ──
            if (showDivider)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: GlassConfig.topFadeHeight,
                child: IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Theme.of(context).scaffoldBackgroundColor,
                          Theme.of(context)
                              .scaffoldBackgroundColor
                              .withValues(alpha: 0),
                        ],
                        stops: GlassConfig.topFadeStops,
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
              child: _buildAgentArea(state),
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
      padding: const EdgeInsets.symmetric(vertical: 16),
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
            ),
          ),
          const SizedBox(height: 4),
          Text(
            dateStr,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 22,
              fontWeight: FontWeight.w500,
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
