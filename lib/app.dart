// lib/app.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'core/glass_config.dart';
import 'features/chat/pages/home_page.dart';
import 'features/diary/pages/diary_page.dart';
import 'features/profile/pages/profile_page.dart';

/// Root app shell with a glass bottom navigation bar.
///
/// Uses [IndexedStack] for instant page switching and an
/// [AnimatedPositioned] pill highlight with [Curves.easeOutCubic] easing for
/// smooth tab transitions.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: IndexedStack(
        index: _currentIndex,
        children: _pages,
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  /// Fixed width of the selection pill highlight.
  static const double _pillWidth = 44;

  // ── Glass capsule bottom nav ────────────────────────────────────
  Widget _buildBottomNav() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tabCount = _icons.length;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: GlassContainer(
          shape: const LiquidRoundedSuperellipse(borderRadius: 999),
          settings: isDark ? GlassConfig.darkNavBar : GlassConfig.navBar,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final tabW = constraints.maxWidth / tabCount;
              return SizedBox(
                height: _pillWidth,
                child: Stack(
                  children: [
                    // ── Sliding indicator with spring animation ──────────
                    AnimatedPositioned(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeOutCubic,
                      left: _currentIndex * tabW + (tabW - _pillWidth) / 2,
                      top: 0,
                      bottom: 0,
                      width: _pillWidth,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF6B6B6B).withValues(
                            alpha: isDark ? 0.2 : 0.05,
                          ),
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                    ),
                    // ── Tab tap targets ────────────────────────────────
                    Row(
                      children: [
                        for (int i = 0; i < tabCount; i++)
                          Expanded(
                            child: GestureDetector(
                              onTap: () => setState(() => _currentIndex = i),
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
        ),
      ),
    );
  }
}
