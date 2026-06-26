// lib/features/chat/widgets/generating_progress.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import 'agent_header.dart';
import 'diary_text.dart';

class GeneratingProgressWidget extends StatefulWidget {
  /// The agent's message text whose line-by-line reveal should finish
  /// before this widget starts sliding in. If null, slides in
  /// immediately.
  final String? agentText;

  const GeneratingProgressWidget({
    super.key,
    this.agentText,
  });

  @override
  State<GeneratingProgressWidget> createState() => _GeneratingProgressWidgetState();
}

class _GeneratingProgressWidgetState extends State<GeneratingProgressWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _fadeAnim;
  late final Animation<Offset> _slideAnim;
  Timer? _startTimer;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );
    final curve = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic);
    _fadeAnim = curve;
    _slideAnim = Tween<Offset>(
      // Fraction of the widget's own width — 50% off the left edge
      // is clearly visible regardless of screen size.
      begin: const Offset(-0.5, 0),
      end: Offset.zero,
    ).animate(curve);

    // Wait for the agent's text to finish revealing before sliding in.
    // Total wait = AgentHeader's fade-out (the swap happens at the
    // midpoint) + DiaryText's line-by-line duration. Using the same
    // estimateDuration the widget uses internally keeps the timing
    // in lockstep — the panel starts moving exactly as the agent's
    // last character finishes sweeping in.
    final delay = widget.agentText != null
        ? AgentHeader.fadeDuration +
            DiaryText.estimateDuration(widget.agentText!)
        : Duration.zero;
    if (delay <= Duration.zero) {
      _ctrl.forward();
    } else {
      _startTimer = Timer(delay, () {
        if (mounted) _ctrl.forward();
      });
    }
  }

  @override
  void dispose() {
    _startTimer?.cancel();
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SlideTransition(
      position: _slideAnim,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: GlassContainer(
          shape: const LiquidRoundedSuperellipse(borderRadius: 16),
          settings: GlassConfig.card,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    Theme.of(context).colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                '正在为您创作~',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
