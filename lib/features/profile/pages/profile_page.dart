// lib/features/profile/pages/profile_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/theme.dart';
import '../../diary/providers/diary_list_provider.dart';

/// Profile page showing user avatar, stats, and settings/about links.
///
/// Watches [diaryListProvider] for the total card count and displays it
/// across three stat cards (日记 / 本月 / 连续 — all MVP placeholders).
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(diaryListProvider);
    final totalCount = cardsAsync.whenOrNull(data: (cards) => cards.length) ?? 0;

    return Scaffold(
      backgroundColor: AppTheme.surfaceDark,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
          child: Column(
            children: [
              // ── Avatar ─────────────────────────────────────────────
              _buildAvatar(),
              const SizedBox(height: 16),
              // ── Name ───────────────────────────────────────────────
              const Text(
                'Finjix 的音乐日记',
                style: TextStyle(
                  color: AppTheme.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 28),
              // ── Stat cards ─────────────────────────────────────────
              Row(
                children: [
                  _StatCard(label: '日记', value: '$totalCount'),
                  const SizedBox(width: 12),
                  _StatCard(label: '本月', value: '$totalCount'),
                  const SizedBox(width: 12),
                  _StatCard(label: '连续', value: '$totalCount'),
                ],
              ),
              const SizedBox(height: 32),
              // ── Settings ───────────────────────────────────────────
              _Tile(
                icon: Icons.settings_rounded,
                label: '设置',
                onTap: () {}, // MVP: no action
              ),
              const SizedBox(height: 4),
              // ── About ──────────────────────────────────────────────
              _Tile(
                icon: Icons.info_outline_rounded,
                label: '关于',
                onTap: () => _showAboutDialog(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Avatar (emoji in glass circle) ────────────────────────────────
  Widget _buildAvatar() {
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 60),
      settings: const LiquidGlassSettings(blur: 12),
      padding: const EdgeInsets.all(20),
      child: const Text(
        '👤',
        style: TextStyle(fontSize: 44),
      ),
    );
  }

  // ── About dialog ──────────────────────────────────────────────────
  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceMedium,
        title: const Text(
          '关于 Meloday',
          style: TextStyle(color: AppTheme.textPrimary),
        ),
        content: const Text(
          'Meloday · 音乐日记\n\n用音乐记录每一天的心情。',
          style: TextStyle(color: AppTheme.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text(
              '好的',
              style: TextStyle(color: AppTheme.accent),
            ),
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Stat card
// ──────────────────────────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final String label;
  final String value;

  const _StatCard({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GlassContainer(
        shape: const LiquidRoundedSuperellipse(borderRadius: 16),
        settings: const LiquidGlassSettings(blur: 8),
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                color: AppTheme.accent,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: const TextStyle(
                color: AppTheme.textSecondary,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Glass list tile (icon + label + chevron)
// ──────────────────────────────────────────────────────────────────────
class _Tile extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _Tile({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 14),
      settings: const LiquidGlassSettings(blur: 6),
      child: ListTile(
        leading: Icon(icon, color: AppTheme.textPrimary),
        title: Text(
          label,
          style: const TextStyle(color: AppTheme.textPrimary),
        ),
        trailing:
            const Icon(Icons.chevron_right_rounded, color: AppTheme.textSecondary),
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}
