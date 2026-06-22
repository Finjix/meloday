// lib/features/chat/pages/home_page.dart
import 'dart:async';
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

  /// Periodic timer that gently nudges the viewport toward the bottom as
  /// new text lines are revealed, then cancels itself once the bottom is
  /// reached.
  Timer? _followTimer;

  /// Stable timestamp for the diary header, set once when the diary area
  /// first appears. Prevents the header key from changing (and thus the
  /// header from being recreated) when the first message is sent.
  DateTime? _headerTimestamp;

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
    _followTimer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  /// Starts a periodic timer that gently nudges the viewport toward the
  /// current bottom as text lines are revealed.  The timer runs until the
  /// content stops growing AND we've reached the bottom.
  void _startFollowingBottom() {
    _followTimer?.cancel();

    // Estimate when the last message's reveal animation will finish so we
    // can auto-cancel even if the content never overflows.
    final state = ref.read(conversationProvider);
    final lastMsg =
        state.userMessages.isNotEmpty ? state.userMessages.last : null;
    final estDurationMs = lastMsg != null
        ? (lastMsg.content.length * 250 + 300).clamp(800, 300_000)
        : 2000;

    final timer = Timer.periodic(
      const Duration(milliseconds: 200),
      (_) => _nudgeTowardBottom(),
    );
    _followTimer = timer;

    // Auto-cancel after the text animation should be done (+ buffer).
    Future.delayed(Duration(milliseconds: estDurationMs + 1500), () {
      // Guard against stale cancellations: only cancel if the timer we
      // scheduled against is still the active one.
      if (_followTimer == timer) {
        _followTimer?.cancel();
        _followTimer = null;
      }
    });
  }

  void _nudgeTowardBottom() {
    if (!_scrollController.hasClients) {
      _followTimer?.cancel();
      _followTimer = null;
      return;
    }
    final pos = _scrollController.position;
    final maxExtent = pos.maxScrollExtent;
    // Content doesn't overflow yet — keep waiting, it's still growing.
    if (maxExtent <= 0) return;
    // We've reached the bottom — done following.
    if (pos.pixels >= maxExtent - 4) {
      _followTimer?.cancel();
      _followTimer = null;
      return;
    }
    _scrollController.animateTo(
      maxExtent,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOut,
    );
  }

  void _handleRetry() {
    ref.read(conversationProvider.notifier).retryFromError();
  }

  /// Each message starts its reveal animation immediately when it is added
  /// to the list. We no longer sequence messages cumulatively because
  /// previous messages have already finished animating by the time a new
  /// message is sent — the cumulative delay caused new messages to remain
  /// invisible for seconds.
  Duration _msgDelay(List<ChatMessage> messages, int msgIndex) {
    return Duration.zero;
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
            .addPostFrameCallback((_) => _startFollowingBottom());
      }
    });

    final state = ref.watch(conversationProvider);
    final theme = Theme.of(context);
    final bgColor = theme.scaffoldBackgroundColor;
    final textColor = theme.colorScheme.onSurface;

    /// Show the diary area only after the user first taps the compose FAB.
    final showDiary = state.hasExpandedInput;
    final agentArea = _buildAgentArea(state);

    // Use a stable timestamp for the diary header. Once set (when the diary
    // area first appears), it never changes — preventing the _DiaryHeader
    // widget key from shifting and destroying the animation state.
    if (showDiary && _headerTimestamp == null) {
      _headerTimestamp = state.userMessages.isNotEmpty
          ? state.userMessages.first.timestamp
          : DateTime.now();
    }
    final headerTimestamp = _headerTimestamp ?? DateTime.now();

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
                    padding: const EdgeInsets.only(bottom: 144),
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

    return _DiaryHeader(
      key: ValueKey('header_$dateStr'),
      weekday: weekday,
      dateStr: dateStr,
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
      duration: const Duration(milliseconds: 300),
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

// ──────────────────────────────────────────────────────────────────────────────
// Diary header — chains weekday → date → divider animations via onComplete.
// ──────────────────────────────────────────────────────────────────────────────
class _DiaryHeader extends StatefulWidget {
  final String weekday;
  final String dateStr;

  const _DiaryHeader({
    super.key,
    required this.weekday,
    required this.dateStr,
  });

  @override
  State<_DiaryHeader> createState() => _DiaryHeaderState();
}

class _DiaryHeaderState extends State<_DiaryHeader> {
  bool _showDate = false;
  bool _showDivider = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 32),
      child: Column(
        children: [
          DiaryText(
            widget.weekday,
            key: const ValueKey('diary_header_weekday'),
            durationOverride: const Duration(milliseconds: 400),
            onComplete: () {
              if (mounted) setState(() => _showDate = true);
            },
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
          if (_showDate)
            DiaryText(
              widget.dateStr,
              key: const ValueKey('diary_header_date'),
              durationOverride: const Duration(milliseconds: 500),
              onComplete: () {
                if (mounted) setState(() => _showDivider = true);
              },
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 22,
                fontWeight: FontWeight.w500,
                fontFamily: AppTheme.diaryFontFamily,
              ),
            ),
          const SizedBox(height: 10),
          if (_showDivider)
            _FadeInDivider(
              delay: Duration.zero,
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
