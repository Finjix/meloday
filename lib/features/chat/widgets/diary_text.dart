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
    _controller = AnimationController(
      duration: widget.durationOverride ??
          const Duration(milliseconds: 2000),
      vsync: this,
    )..addStatusListener((s) {
        if (s == AnimationStatus.completed) widget.onComplete?.call();
      });

    if (widget.delay != null) {
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

          final ms = (_lines.length * 650 + 150).clamp(200, 60_000);
          _controller.duration = Duration(milliseconds: ms);
        }

        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final t = _controller.value.clamp(0.0, 1.0);
            final n = _lines.length;
            if (n == 0) return const SizedBox.shrink();

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: List.generate(n, (i) {
                final lineStart = i / n;
                final lineEnd = (i + 1) / n;
                double p;
                if (t < lineStart) {
                  p = 0;
                } else if (t >= lineEnd) {
                  p = 1;
                } else {
                  p = (t - lineStart) / (lineEnd - lineStart);
                }
                p = Curves.easeOut.transform(p);

                return ClipRect(
                  child: Align(
                    alignment: Alignment.centerLeft,
                    widthFactor: p.clamp(0.0, 1.0),
                    child: Text(
                      _lines[i],
                      style: widget.style,
                      maxLines: 1,
                    ),
                  ),
                );
              }),
            );
          },
        );
      },
    );
  }
}
