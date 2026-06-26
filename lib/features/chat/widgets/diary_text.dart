// lib/features/chat/widgets/diary_text.dart
import 'package:flutter/material.dart';

/// Reveals text line by line, sweeping each line from left to right.
///
/// Per-character reveal time is constant, so the sweep speed (width
/// per second) is the same regardless of text length. The animation
/// plays once. Use [key] so each message keeps its own state.
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

  /// Per-character reveal rate used by the default duration. Exposed so
  /// callers (e.g. the conversation state machine) can time other UI
  /// events off the same animation without duplicating the formula.
  static const int perCharMs = 30;

  /// Returns the duration the widget will use to reveal [text] under
  /// its default per-character rate. Useful for sequencing: the agent
  /// reply can wait for `DiaryText.estimateDuration(userText) + thinking`
  /// before showing, so the user's text finishes revealing first.
  static Duration estimateDuration(String text) {
    final visibleChars =
        text.length - '\n'.allMatches(text).length;
    return Duration(
      milliseconds: (visibleChars * perCharMs).clamp(100, 30_000),
    );
  }

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
    final dur = widget.durationOverride ?? DiaryText.estimateDuration(widget.text);
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

        if (w != _lastWidth && w > 0 && w.isFinite) {
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

            // Empty lines contribute 0 to totalChars — they take 0
            // animation time and appear at the moment the previous
            // non-empty line finishes. This keeps per-char time exact.
            final totalChars = _lines.fold<int>(
              0,
              (sum, line) => sum + line.length,
            );
            if (totalChars == 0) {
              // All lines empty — render the column as-is.
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: _lines
                    .map((l) => Text(l, style: widget.style, maxLines: 1))
                    .toList(),
              );
            }

            // Cumulative start positions for each line [0.0 … 1.0).
            double cum = 0;
            final starts = <double>[];
            for (final line in _lines) {
              starts.add(cum / totalChars);
              cum += line.length;
            }

            // Only include lines that have started their reveal.
            // Lines that haven't started yet are omitted from the tree,
            // so the Column height grows as each new line appears.
            final visible = <Widget>[];
            for (int i = 0; i < n; i++) {
              final lineStart = starts[i];
              final lineEnd = i + 1 < n ? starts[i + 1] : 1.0;

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
