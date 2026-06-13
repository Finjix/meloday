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
final _kColorPalette = <String, String>{
  ...MoodColors.tagToColor,
  '天空': '#64B5F6',
  '优雅': '#CE93D8',
  '热情': '#EF5350',
  '梦幻': '#BA68C8',
  '活力': '#FF7043',
  '清新': '#4DB6AC',
  '希望': '#AED581',
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
        LayoutBuilder(
          builder: (context, constraints) {
            final crossAxisCount = constraints.maxWidth > 600 ? 14 : 7;
            return GridView.count(
              crossAxisCount: crossAxisCount,
              mainAxisSpacing: 12,
              crossAxisSpacing: 10,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              children: _kColorPalette.entries.map((entry) {
                final color = AppTheme.moodColorFromHex(entry.value);
                final isSelected = entry.value.toUpperCase() == currentHex.toUpperCase();
                return Center(
                  child: SizedBox(
                    width: 40,
                    height: 40,
                    child: _ColorSwatch(
                      color: color,
                      isSelected: isSelected,
                      onTap: () => onColorSelected(entry.value),
                    ),
                  ),
                );
              }).toList(),
            );
          },
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
      settings: isDark
          ? GlassConfig.darkCard
          : GlassConfig.card.copyWith(shadowElevation: 0),
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

/// A custom toggle switch with no Material shadow/border artifacts.
class _CustomSwitch extends StatelessWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const _CustomSwitch({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.primary;
    return GestureDetector(
      onTap: () => onChanged(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: 52,
        height: 28,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: value ? color.withValues(alpha: 0.4) : Colors.grey.shade300,
        ),
        padding: const EdgeInsets.all(2),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: value ? color : Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}
