// lib/features/chat/pages/home_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/conversation_state.dart';
import '../providers/conversation_provider.dart';
import '../widgets/agent_header.dart';

import '../widgets/generating_progress.dart';
import '../widgets/user_diary_list.dart';
import '../../card/widgets/music_card_compact.dart';

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage> {
  final _scrollController = ScrollController();
  int _lastMessageCount = 0;

  @override
  void initState() {
    super.initState();
    // Trigger the greeting on first load.
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
                  Icon(Icons.error_outline, color: Theme.of(context).colorScheme.primary, size: 20),
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
                    child: Text(
                      '重试',
                      style: TextStyle(color: Theme.of(context).colorScheme.primary, fontSize: 14),
                    ),
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

    // Reset scroll tracking when conversation restarts
    if (state.status == ConvStatus.idle) {
      _lastMessageCount = 0;
    }

    // Auto-scroll when a new user message is added.
    if (state.userMessages.length > _lastMessageCount) {
      _lastMessageCount = state.userMessages.length;
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());
    }

    final showDivider = state.userMessages.isNotEmpty;
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top: Agent area ──────────────────────────────────────
            _buildAgentArea(state),

            // ── Divider (only when user has messages) ────────────────
            if (showDivider)
              Divider(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                height: 1,
                thickness: 0.5,
                indent: 20,
                endIndent: 20,
              ),

            // ── Middle: User diary list ──────────────────────────────
            Expanded(
              child: UserDiaryList(
                messages: state.userMessages,
                scrollController: _scrollController,
              ),
            ),

            // ── Bottom inset is handled by AppShell ────────────────────
            const SizedBox(height: 1),
          ],
        ),
      ),
    );
  }
}
