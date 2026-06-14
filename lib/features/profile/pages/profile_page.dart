// lib/features/profile/pages/profile_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme.dart';
import '../../../main.dart';
import '../../../models/mood_colors.dart';

/// Profile page — theme color picker only.
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
              _ThemeColorPicker(
                currentHex: currentAccentHex,
                onColorSelected: (hex) => _onColorSelected(ref, hex),
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

// ── Theme colour picker ────────────────────────────────────────────────

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
                  size: 18,
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
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
