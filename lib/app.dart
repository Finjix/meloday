// lib/app.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'core/glass_config.dart';
import 'features/chat/pages/home_page.dart';
import 'features/chat/providers/conversation_provider.dart';
import 'features/chat/widgets/chat_input.dart';
import 'models/conversation_state.dart';
import 'features/diary/pages/diary_page.dart';
import 'features/profile/pages/profile_page.dart';

/// Root app shell with a glass bottom navigation bar.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell>
    with TickerProviderStateMixin {
  int _currentIndex = 0;
  bool _isInputExpanded = false;

  final _textController = TextEditingController();
  final _hasTextNotifier = ValueNotifier(false);

  late final AnimationController _slideController;
  late final Animation<Offset> _barSlide;
  late final Animation<Offset> _inputSlide;

  late final AnimationController _tabAnim;

  static const _pages = <Widget>[
    HomePage(),
    DiaryPage(),
    ProfilePage(),
  ];

  static const _icons = [
    Icons.home_rounded,
    Icons.menu_book_rounded,
    Icons.person_rounded,
  ];

  static const double _pillWidth = 44;
  static const double _pillInnerPadV = 10;
  static const double _pillOuterPadV = 12;
  static const double _fabSize = 66;
  static const double _fabGap = 12;
  static const double _fabPadR = 20;

  /// Total horizontal space the FAB area occupies when visible.
  static const double _fabArea = _fabGap + _fabSize + _fabPadR; // 98

  @override
  void initState() {
    super.initState();
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _barSlide = Tween<Offset>(
      begin: Offset.zero,
      end: const Offset(0, 1.5),
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: const Interval(0.0, 0.375, curve: Curves.easeInOut),
    ));
    _inputSlide = Tween<Offset>(
      begin: const Offset(0, 1.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _slideController,
      curve: const Interval(0.375, 1.0, curve: Curves.easeInOut),
    ));
    _slideController.addStatusListener((status) {
      if (status == AnimationStatus.dismissed ||
          status == AnimationStatus.completed) {
        setState(() {});
      }
    });

    _tabAnim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    _textController.addListener(_onTextChanged);
    _onSendStable = _sendMessage;
  }

  late final VoidCallback _onSendStable;

  void _onTextChanged() {
    _hasTextNotifier.value = _textController.text.trim().isNotEmpty;
  }

  @override
  void dispose() {
    _textController.removeListener(_onTextChanged);
    _textController.dispose();
    _hasTextNotifier.dispose();
    _slideController.dispose();
    _tabAnim.dispose();
    super.dispose();
  }

  void _toggleInput() {
    setState(() {
      _isInputExpanded = !_isInputExpanded;
      if (_isInputExpanded) {
        _slideController.forward();
      } else {
        _slideController.reverse();
      }
    });
  }

  void _handleFabTap() {
    debugPrint('Meloday: _handleFabTap — '
        'isExpanded=$_isInputExpanded '
        'hasText=${_textController.text.trim().isNotEmpty}');
    if (!_isInputExpanded) {
      _toggleInput();
      ref.read(conversationProvider.notifier).markInputExpanded();
    } else if (_textController.text.trim().isNotEmpty) {
      _sendMessage();
    } else {
      _toggleInput();
    }
  }

  void _sendMessage() {
    final text = _textController.text.trim();
    if (text.isEmpty) return;
    final status = ref.read(conversationProvider).status;
    if (status == ConvStatus.generating) return;
    try {
      ref.read(conversationProvider.notifier).sendMessage(text);
      _textController.clear();
      _toggleInput();
    } catch (_) {
      // Keep text and input open on failure
    }
  }

  void _switchTab(int index) {
    if (index == _currentIndex) return;
    if (_isInputExpanded) _toggleInput();

    if (index == 0) {
      _tabAnim.reverse(); // show FAB
    } else if (_currentIndex == 0) {
      _tabAnim.forward(); // hide FAB
    }
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
    final showInput =
        _currentIndex == 0 && (_isInputExpanded || _slideController.isAnimating);
    final showBar =
        !_isInputExpanded || !_slideController.isCompleted;

    // Adaptive bottom fade: nav bar total height + extra fade zone
    final safeBottom = MediaQuery.of(context).padding.bottom;
    final barTotalHeight =
        safeBottom + _pillOuterPadV * 2 + _pillInnerPadV * 2 + _pillWidth;
    final bottomFadeHeight = barTotalHeight + GlassConfig.bottomFadePadding;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Stack(
        children: [
          // ── Page content ──────────────────────────────────────────
          // IndexedStack keeps all pages alive so local widget state
          // (animations, scroll position) survives tab switches.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            child: GestureDetector(
              onTap: _isInputExpanded ? _toggleInput : null,
              behavior: HitTestBehavior.opaque,
              child: IndexedStack(
                index: _currentIndex,
                children: _pages.map((page) => Center(
                  child: ConstrainedBox(
                    constraints:
                        const BoxConstraints(maxWidth: GlassConfig.maxContentWidth),
                    child: page,
                  ),
                )).toList(),
              ),
            ),
          ),

          // ── Bottom gradient fade — height adapts to nav bar ──
          if (showBar || showInput)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: bottomFadeHeight,
              child: IgnorePointer(
                child: RepaintBoundary(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Theme.of(context)
                              .scaffoldBackgroundColor
                              .withValues(alpha: 0),
                          Theme.of(context).scaffoldBackgroundColor,
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

          // ── Animated bottom row — only this subtree rebuilds on ──
          // ── tabAnim ticks, not the entire AppShell.              ──
          AnimatedBuilder(
            animation: _tabAnim,
            builder: (context, child) {
              final t = _tabAnim.value;
              final showFab = _currentIndex == 0 || _tabAnim.isAnimating;
              final barRight = _fabPadR + _fabArea * (1 - t);
              final fabRight = _fabPadR - _fabArea * t;
              final fabOpacity = (1 - t).clamp(0.0, 1.0);

              return Stack(
                children: [
                  // ── Bar ─────────────────────────────────────────
                  if (showBar)
                    Positioned(
                      left: 0,
                      right: barRight,
                      bottom: 0,
                      child: SafeArea(
                        child: Padding(
                          padding: EdgeInsets.only(
                            left: _fabPadR,
                            top: _pillOuterPadV,
                            bottom: _pillOuterPadV,
                          ),
                          child: SlideTransition(
                            position: _barSlide,
                            child: child,
                          ),
                        ),
                      ),
                    ),

                  // ── Input ───────────────────────────────────────
                  if (showInput)
                    Positioned(
                      left: 0,
                      right: barRight,
                      bottom: 0,
                      child: SafeArea(
                        child: Padding(
                          padding: EdgeInsets.only(
                            left: _fabPadR,
                            top: _pillOuterPadV,
                            bottom: _pillOuterPadV,
                          ),
                          child: SlideTransition(
                            position: _inputSlide,
                            child: InputPanel(
                              controller: _textController,
                              onSend: _onSendStable,
                              enabled: ref.watch(conversationProvider)
                                      .status !=
                                  ConvStatus.generating,
                            ),
                          ),
                        ),
                      ),
                    ),

                  // ── FAB — slides off-screen on tab switch ──────
                  if (showFab)
                    Positioned(
                      right: fabRight,
                      bottom: 0,
                      child: Opacity(
                        opacity: fabOpacity,
                        child: SafeArea(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                vertical: _pillOuterPadV),
                            child: ValueListenableBuilder(
                              valueListenable: _hasTextNotifier,
                              builder: (_, hasText, _) => ChatFab(
                                isExpanded: _isInputExpanded,
                                hasText: hasText,
                                onTap: _handleFabTap,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
            child: _buildNavPill(),
          ),
        ],
      ),
    );
  }

  Widget _buildNavPill() {
    final tabCount = _icons.length;
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 999),
      settings: GlassConfig.navBar,
      padding: const EdgeInsets.symmetric(
        horizontal: 20,
        vertical: _pillInnerPadV,
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final tabW = constraints.maxWidth / tabCount;
          return SizedBox(
            height: _pillWidth,
            child: Stack(
              children: [
                AnimatedPositioned(
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOutCubic,
                  left: _currentIndex * tabW + (tabW - _pillWidth) / 2,
                  top: 0,
                  bottom: 0,
                  width: _pillWidth,
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF6B6B6B).withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
                Row(
                  children: [
                    for (int i = 0; i < tabCount; i++)
                      Expanded(
                        child: GestureDetector(
                          onTap: () => _switchTab(i),
                          behavior: HitTestBehavior.opaque,
                          child: Center(
                            child: Icon(
                              _icons[i],
                              color: _currentIndex == i
                                  ? Theme.of(context).colorScheme.primary
                                  : Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                              size: 24,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
