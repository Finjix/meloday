// lib/features/card/widgets/music_card_compact.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../models/music_card.dart';
import '../../../core/theme.dart';

/// A compact music card widget for timeline lists.
///
/// Text-only row layout inside a glass container with a mood color border.
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
          ],
        ),
      ),
    );
  }
}

