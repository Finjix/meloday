// lib/features/chat/widgets/generating_progress.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import 'agent_header.dart';
import 'diary_text.dart';

/// Two states the bottom-area status pill can be in:
/// - [generating]: spinner + "正在为您创作~" while the agent builds
///   the music card.
/// - [ready]: "创作完成，点击查看！" tappable prompt. The parent
///   listens for the tap and shows the centered card-reveal scene.
enum GeneratingStatus { generating, ready }

class GeneratingProgressWidget extends StatefulWidget {
  final GeneratingStatus status;
  final String? agentText;
  final VoidCallback? onTap;

  const GeneratingProgressWidget({
    super.key,
    this.status = GeneratingStatus.generating,
    this.agentText,
    this.onTap,
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
        // GestureDetector wraps the whole glass pill so the entire
        // pill is tappable, not just the text inside.
        child: GestureDetector(
          onTap: widget.status == GeneratingStatus.ready ? widget.onTap : null,
          behavior: HitTestBehavior.opaque,
          child: GlassContainer(
            shape: const LiquidRoundedSuperellipse(borderRadius: 16),
            settings: GlassConfig.card,
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: switch (widget.status) {
              GeneratingStatus.generating => _buildGeneratingContent(context),
              GeneratingStatus.ready => _buildReadyContent(context),
            },
          ),
        ),
      ),
    );
  }

  Widget _buildGeneratingContent(BuildContext context) {
    return Row(
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
    );
  }

  Widget _buildReadyContent(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '创作完成，点击查看！',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
        const SizedBox(width: 8),
        Icon(
          Icons.arrow_forward_rounded,
          size: 16,
          color: primary,
        ),
      ],
    );
  }
}
