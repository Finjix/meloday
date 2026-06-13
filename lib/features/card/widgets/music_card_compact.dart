// lib/features/card/widgets/music_card_compact.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../models/music_card.dart';
import '../../../core/theme.dart';

/// A compact music card widget for timeline lists.
///
/// Row layout: cover thumbnail (left) + card name (center) + chevron (right).
/// Uses a glossy glass container with a mood color border.
class MusicCardCompact extends StatelessWidget {
  final MusicCard card;
  final VoidCallback? onTap;

  const MusicCardCompact({
    super.key,
    required this.card,
    this.onTap,
  });

  /// Resolves [MusicCard.moodColor] (a hex string) to a [Color].
  Color get _moodColor => AppTheme.moodColorFromHex(card.moodColor);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: GlassContainer(
        shape: LiquidRoundedSuperellipse(
          borderRadius: 14,
          side: BorderSide(
            color: _moodColor.withValues(alpha: 0.4),
            width: 1,
          ),
        ),
        settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
        padding: const EdgeInsets.all(10),
        child: Row(
          children: [
            // ── Cover thumbnail (gradient placeholder) ────────────────
            _CoverThumbnail(moodColor: _moodColor),
            const SizedBox(width: 12),
            // ── Card name ─────────────────────────────────────────────
            Expanded(
              child: Text(
                card.name,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 4),
            // ── Chevron ───────────────────────────────────────────────
            Icon(
              Icons.chevron_right_rounded,
              color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
              size: 22,
            ),
          ],
        ),
      ),
    );
  }
}

/// A colorful gradient cover placeholder.
///
/// Generates a hue rotation from the mood color so every card gets a
/// distinct gradient without needing to load an actual image yet.
class _CoverThumbnail extends StatelessWidget {
  final Color moodColor;

  const _CoverThumbnail({required this.moodColor});

  @override
  Widget build(BuildContext context) {
    final gradientColors = AppTheme.gradientPairFromMood(moodColor);

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradientColors,
        ),
        boxShadow: [
          BoxShadow(
            color: moodColor.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: const Center(
        child: Text(
          '🎵',
          style: TextStyle(fontSize: 22),
        ),
      ),
    );
  }
}
