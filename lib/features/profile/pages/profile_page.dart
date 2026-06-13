// lib/features/profile/pages/profile_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../core/theme.dart';
import '../../../main.dart';
import '../../../models/mood_colors.dart';
import '../../diary/providers/diary_list_provider.dart';

/// Profile page showing user avatar, stats, settings, and theme color picker.
///
/// Watches [diaryListProvider] for the total card count and displays it
/// across three stat cards (日记 / 本月 / 连续 — all MVP placeholders).
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(diaryListProvider);
    final totalCount = cardsAsync.whenOrNull(data: (cards) => cards.length) ?? 0;
    final currentAccentHex = ref.watch(themeAccentProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
          child: Column(
            children: [
              // ── Avatar ─────────────────────────────────────────────
              _buildAvatar(context),
              const SizedBox(height: 16),
              // ── Name ───────────────────────────────────────────────
              Text(
                'Finjix 的音乐日记',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
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
              // ── Theme colour picker ───────────────────────────────
              _ThemeColorPicker(
                currentHex: currentAccentHex,
                onColorSelected: (hex) =>
                    _onColorSelected(ref, hex),
              ),
              const SizedBox(height: 4),
              // ── Dark mode toggle ────────────────────────────────────
              _DarkModeToggle(),
              const SizedBox(height: 24),
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

  void _onColorSelected(WidgetRef ref, String hex) {
    ref.read(themeAccentProvider.notifier).state = hex;
    ref.read(storageServiceProvider).saveThemeColor(hex).catchError((e) {
      debugPrint('Failed to save theme color: $e');
    });
  }

  // ── Avatar (emoji in glass circle) ────────────────────────────────
  Widget _buildAvatar(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 60),
      settings: isDark ? GlassConfig.darkInteractive : GlassConfig.interactive,
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
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        title: Text(
          '关于 Meloday',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        content: Text(
          'Meloday · 音乐日记\n\n用音乐记录每一天的心情。',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              '好的',
              style: TextStyle(color: Theme.of(context).colorScheme.primary),
            ),
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Theme colour picker
// ──────────────────────────────────────────────────────────────────────

/// Color palette entries: label → hex.
/// Built from [MoodColors.tagToColor] plus a few extras not in the mood set.
final _kColorPalette = <String, String>{
  ...MoodColors.tagToColor,
  '天空': '#64B5F6', // sky blue — extra
  '优雅': '#CE93D8', // lavender — extra
  '热情': '#EF5350', // red — extra
};

class _ThemeColorPicker extends StatelessWidget {
  final String currentHex;
  final ValueChanged<String> onColorSelected;

  const _ThemeColorPicker({
    required this.currentHex,
    required this.onColorSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 12),
          child: Row(
            children: [
              Icon(Icons.palette_outlined,
                  size: 18, color: Theme.of(context).colorScheme.onSurfaceVariant),
              const SizedBox(width: 8),
              Text(
                '主题色',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: _kColorPalette.entries.map((entry) {
            final color = AppTheme.moodColorFromHex(entry.value);
            final isSelected = entry.value.toUpperCase() == currentHex.toUpperCase();
            return _ColorSwatch(
              color: color,
              label: entry.key,
              isSelected: isSelected,
              onTap: () => onColorSelected(entry.value),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _ColorSwatch extends StatelessWidget {
  final Color color;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _ColorSwatch({
    required this.color,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: isSelected ? 54 : 44,
            height: isSelected ? 54 : 44,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              border: isSelected
                  ? Border.all(color: Colors.white, width: 3)
                  : null,
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: color.withValues(alpha: 0.4),
                        blurRadius: 8,
                        spreadRadius: 1,
                      ),
                    ]
                  : null,
            ),
            child: isSelected
                ? const Icon(Icons.check, color: Colors.white, size: 22)
                : null,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Expanded(
      child: GlassContainer(
        shape: const LiquidRoundedSuperellipse(borderRadius: 16),
        settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                color: Theme.of(context).colorScheme.primary,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 14),
      settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.onSurface),
        title: Text(
          label,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        trailing:
            Icon(Icons.chevron_right_rounded, color: Theme.of(context).colorScheme.onSurfaceVariant),
        onTap: onTap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────
// Dark mode toggle
// ──────────────────────────────────────────────────────────────────────

class _DarkModeToggle extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final isDark = themeMode == ThemeMode.dark;

    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 14),
      settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
      child: ListTile(
        leading: Icon(
          isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
          color: Theme.of(context).colorScheme.onSurface,
        ),
        title: Text(
          '深色模式',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        trailing: Switch(
          value: isDark,
          activeThumbColor: Theme.of(context).colorScheme.primary,
          onChanged: (value) {
            final newMode = value ? ThemeMode.dark : ThemeMode.light;
            ref.read(themeModeProvider.notifier).state = newMode;
            ref.read(storageServiceProvider)
                .saveThemeMode(value ? 'dark' : 'light')
                .catchError((e) {
                  debugPrint('Failed to save theme mode: $e');
                });
          },
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}
