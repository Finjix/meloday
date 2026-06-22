// lib/features/chat/widgets/diary_text.dart
import 'package:flutter/material.dart';

/// Reveals text line by line, sweeping each line from left to right.
///
/// Paragraphs separated by `\n` are further split into visual lines based on
/// the actual container width (estimated via CJK character width).
///
/// The animation plays once. Use [key] so each message keeps its own state.
class DiaryText extends StatefulWidget {
  final String text;
  final TextStyle style;
  final Duration? delay;
  final Duration? durationOverride;
  final VoidCallback? onComplete;

  const DiaryText(
    this.text, {
    super.key,
    required this.style,
    this.delay,
    this.durationOverride,
    this.onComplete,
  });

  @override
  State<DiaryText> createState() => _DiaryTextState();
}

class _DiaryTextState extends State<DiaryText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  /// Cached visual lines — recomputed only when the container width changes.
  List<String> _lines = const [];
  double _lastWidth = -1;

  @override
  void initState() {
    super.initState();
    // Compute duration upfront (character-based) so the animation starts
    // with the correct speed — no mid-animation duration change needed.
    final dur = widget.durationOverride ??
        Duration(
          milliseconds:
              (widget.text.length * 150 + 300).clamp(800, 30_000),
        );
    _controller = AnimationController(
      duration: dur,
      vsync: this,
    )..addStatusListener((s) {
        if (s == AnimationStatus.completed) widget.onComplete?.call();
      });

    if (widget.delay != null && widget.delay != Duration.zero) {
      Future.delayed(widget.delay!, () {
        if (mounted) _controller.forward();
      });
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  // ── Line splitting ─────────────────────────────────────────────────────

  /// Approximate width of a single CJK character at the given font size.
  static double _charWidth(double fontSize) => fontSize * 0.55;

  static List<String> _splitLines(String text, double maxWidth, double fontSize) {
    final charsPerLine =
        (maxWidth / _charWidth(fontSize)).floor().clamp(1, 500);

    final result = <String>[];
    for (final para in text.split('\n')) {
      if (para.isEmpty) {
        result.add('');
        continue;
      }
      if (para.length <= charsPerLine) {
        result.add(para);
      } else {
        for (int i = 0; i < para.length; i += charsPerLine) {
          result.add(
            para.substring(i, (i + charsPerLine).clamp(0, para.length)),
          );
        }
      }
    }
    return result;
  }

  // ── Build ──────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;

        // Re-split only when the container width changes, unless duration is
        // overridden (then we still need to split lines for rendering).
        if (widget.durationOverride != null) {
          if (w != _lastWidth && w > 0 && w.isFinite) {
            _lastWidth = w;
            _lines = _splitLines(
                widget.text, w, widget.style.fontSize ?? 17);
          }
        } else if (w != _lastWidth && w > 0 && w.isFinite) {
          _lastWidth = w;
          _lines = _splitLines(
              widget.text, w, widget.style.fontSize ?? 17);
        }

        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = _controller.value.clamp(0.0, 1.0);
            final n = _lines.length;
            if (n == 0) return const SizedBox.shrink();

            // Only include lines that have started their reveal.
            // Lines that haven't started yet are omitted from the tree,
            // so the Column height grows as each new line appears.
            final visible = <Widget>[];
            for (int i = 0; i < n; i++) {
              final lineStart = i / n;
              final lineEnd = (i + 1) / n;

              if (t < lineStart) {
                // Not yet started — stop here; future lines add no height.
                break;
              }

              double p;
              if (t >= lineEnd) {
                p = 1.0;
              } else {
                p = (t - lineStart) / (lineEnd - lineStart);
              }
              p = Curves.easeOut.transform(p);

              if (p >= 1.0) {
                // Fully revealed — show the full line without clipping.
                visible.add(Text(
                  _lines[i],
                  style: widget.style,
                  maxLines: 1,
                ));
              } else {
                // In progress — clip from left using widthFactor.
                visible.add(ClipRect(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    widthFactor: p.clamp(0.0, 1.0),
                    child: Text(
                      _lines[i],
                      style: widget.style,
                      maxLines: 1,
                    ),
                  ),
                ));
              }
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: visible,
            );
          },
        );
      },
    );
  }
}
