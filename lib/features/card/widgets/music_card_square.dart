// lib/features/card/widgets/music_card_square.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../core/theme.dart';
import '../../../models/music_card.dart';

/// A square music card used for the centered "card ready" reveal.
///
/// Layout: full-bleed mood-color gradient with a large 🎵 glyph,
/// card name overlaid at the bottom on a dark-to-transparent
/// gradient for legibility. Tappable to open the detail page.
class MusicCardSquare extends StatelessWidget {
  final MusicCard card;
  final VoidCallback? onTap;
  final double size;

  const MusicCardSquare({
    super.key,
    required this.card,
    this.onTap,
    this.size = 320,
  });

  Color get _moodColor => AppTheme.moodColorFromHex(card.moodColor);

  @override
  Widget build(BuildContext context) {
    final gradientColors = AppTheme.gradientPairFromMood(_moodColor);
    // Scale the emoji with the card so the visual stays balanced
    // whether the card is 280 or 360 px wide.
    final emojiSize = size * 0.3;

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: size,
        height: size,
        child: GlassContainer(
          shape: LiquidRoundedSuperellipse(
            borderRadius: 20,
            side: BorderSide(
              color: _moodColor.withValues(alpha: 0.5),
              width: 1.5,
            ),
          ),
          settings: GlassConfig.card,
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              // ── Cover: mood-color gradient with large 🎵 glyph ─────
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: gradientColors,
                    ),
                  ),
                  child: Center(
                    child: Text(
                      '🎵',
                      style: TextStyle(
                        fontSize: emojiSize,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ),
                ),
              ),
              // ── Card name at bottom, on dark gradient for contrast ──
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.6),
                      ],
                      stops: const [0.0, 1.0],
                    ),
                  ),
                  child: Text(
                    card.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
