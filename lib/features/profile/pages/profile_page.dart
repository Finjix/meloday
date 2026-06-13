// lib/features/profile/pages/profile_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../core/theme.dart';
import '../../../main.dart';
import '../../../models/mood_colors.dart';

/// Profile page — theme color picker + dark mode toggle only.
class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentAccentHex = ref.watch(themeAccentProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
          child: Column(
            children: [
              _DarkModeToggle(),
              const SizedBox(height: 40),
              _ThemeColorPicker(
                currentHex: currentAccentHex,
                onColorSelected: (hex) =>
                    _onColorSelected(ref, hex),
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
}

// ──────────────────────────────────────────────────────────────────────
// Theme colour picker
// ──────────────────────────────────────────────────────────────────────

/// Color palette entries: label → hex.
/// Built from [MoodColors.tagToColor] plus a few extras not in the mood set.
final _kColorPalette = <String>[
  ...MoodColors.tagToColor.values,
  '#00BCD4',
  '#CE93D8',
  '#EF5350',
  '#AD1457',
  '#FF7043',
  '#C0CA33',
  '#2E7D32',
  '#1A237E',
  '#FFB300',
  '#827717',
  '#EC407A',
];

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
          spacing: 10,
          runSpacing: 12,
          children: _kColorPalette.map((hex) {
            final color = AppTheme.moodColorFromHex(hex);
            final isSelected = hex.toUpperCase() == currentHex.toUpperCase();
            return SizedBox(
              width: 40,
              height: 40,
              child: _ColorSwatch(
                color: color,
                isSelected: isSelected,
                onTap: () => onColorSelected(hex),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _ColorSwatch extends StatelessWidget {
  final Color color;
  final bool isSelected;
  final VoidCallback onTap;

  const _ColorSwatch({
    required this.color,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedScale(
        scale: isSelected ? 1.18 : 1.0,
        duration: const Duration(milliseconds: 200),
        child: Container(
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
          ),
          child: isSelected
              ? const Icon(Icons.check, color: Colors.white, size: 22)
              : null,
        ),
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
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 16),
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
        trailing: _CustomSwitch(
          value: isDark,
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

/// A minimal toggle switch designed to sit on a glass surface without
/// competing with it — no glass gradient on the track, just a thin pill
/// outline and a solid dot as the primary indicator.
class _CustomSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _CustomSwitch({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accent = Theme.of(context).colorScheme.primary;

    return GestureDetector(
      onTap: () => onChanged(!value),
      child: Container(
        width: 52,
        height: 28,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: value ? accent.withValues(alpha: 0.15) : Colors.transparent,
          border: Border.all(
            color: value
                ? accent.withValues(alpha: 0.5)
                : isDark
                    ? Colors.white.withValues(alpha: 0.15)
                    : Colors.black.withValues(alpha: 0.12),
            width: 1.5,
          ),
        ),
        padding: const EdgeInsets.all(2),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          alignment:
              value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: value
                  ? accent
                  : isDark
                      ? Colors.white.withValues(alpha: 0.35)
                      : Colors.black.withValues(alpha: 0.18),
              boxShadow: value
                  ? [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.4),
                        blurRadius: 6,
                        offset: const Offset(0, 1),
                      ),
                    ]
                  : null,
            ),
          ),
        ),
      ),
    );
  }
}
