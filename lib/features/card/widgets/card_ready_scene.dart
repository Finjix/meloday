// lib/features/card/widgets/card_ready_scene.dart
import 'dart:ui';
import 'package:flutter/material.dart';
import 'music_card_square.dart';
import '../../../models/music_card.dart';

/// The full "card is ready" reveal scene: blurred+dimmed background
/// scrim with the square card fading and scaling in over it.
///
/// Tapping the scrim (anywhere outside the card) reverses the entrance
/// animation and invokes [onDismiss] when the reverse completes —
/// that's the parent's cue to update state and unmount this widget.
///
/// Renders into whatever parent hands it bounded constraints (typically
/// `Positioned.fill` in a Stack).
class CardReadyScene extends StatefulWidget {
  final MusicCard card;
  final VoidCallback? onTap;
  final VoidCallback? onDismiss;

  const CardReadyScene({
    super.key,
    required this.card,
    this.onTap,
    this.onDismiss,
  });

  @override
  State<CardReadyScene> createState() => _CardReadySceneState();
}

class _CardReadySceneState extends State<CardReadyScene>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  bool _dismissing = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    )..forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _dismiss() {
    if (_dismissing) return;
    _dismissing = true;
    // Reverse the same controller that drove the entrance — the
    // scrim fades back to 0 blur, the card fades and shrinks out.
    // When the reverse animation finishes, tell the parent so it
    // can drop us out of the tree (and update its state).
    _ctrl.reverse().then((_) {
      if (mounted) widget.onDismiss?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cardSize = (constraints.maxWidth - 40)
            .clamp(220.0, 340.0)
            .toDouble();

        return AnimatedBuilder(
          animation: _ctrl,
          builder: (context, _) {
            // easeOutCubic gives a smooth deceleration on entrance;
            // the same curve plays in reverse on dismiss, so the
            // exit feels like the entrance unwound.
            final t = Curves.easeOutCubic.transform(_ctrl.value);

            return Stack(
              children: [
                // ── Background scrim: blur + dim. Tapping anywhere
                //    on this layer (i.e. outside the card) dismisses.
                //    HitTestBehavior.opaque ensures taps don't leak
                //    through to page content below.
                Positioned.fill(
                  child: GestureDetector(
                    onTap: _dismiss,
                    behavior: HitTestBehavior.opaque,
                    child: BackdropFilter(
                      filter: ImageFilter.blur(
                        sigmaX: 12 * t,
                        sigmaY: 12 * t,
                      ),
                      child: Container(
                        color: Colors.black.withValues(alpha: 0.35 * t),
                      ),
                    ),
                  ),
                ),

                // ── Square card on top. Its own GestureDetector
                //    (inside MusicCardSquare) catches taps on the
                //    card first, so the dismiss handler below only
                //    fires for taps in the surrounding scrim.
                Positioned.fill(
                  child: Center(
                    child: Opacity(
                      opacity: t,
                      child: Transform.scale(
                        scale: 0.92 + 0.08 * t,
                        child: MusicCardSquare(
                          card: widget.card,
                          size: cardSize,
                          onTap: widget.onTap,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
