// lib/features/chat/widgets/agent_header.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../models/chat_message.dart';
import 'diary_text.dart';

class AgentHeader extends StatefulWidget {
  final ChatMessage? message;

  const AgentHeader({super.key, this.message});

  /// Per-phase fade duration for the bubble swap (fade out + fade in
  /// together = 2 × this). Exposed so sibling widgets (e.g. the
  /// generating-progress panel) can wait for the agent's text reveal
  /// to finish before staging their own entrance.
  static const Duration fadeDuration = Duration(milliseconds: 400);

  @override
  State<AgentHeader> createState() => _AgentHeaderState();
}

class _AgentHeaderState extends State<AgentHeader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  /// The message currently being rendered. May lag behind [widget.message]
  /// during the fade-out → swap → fade-in transition.
  ChatMessage? _shown;

  @override
  void initState() {
    super.initState();
    _shown = widget.message;
    _ctrl = AnimationController(
      duration: const Duration(milliseconds: 400),
      vsync: this,
      // Start fully visible if we have a message, hidden otherwise.
      value: widget.message != null ? 1.0 : 0.0,
    );
  }

  @override
  void didUpdateWidget(AgentHeader old) {
    super.didUpdateWidget(old);
    final newId = widget.message?.id;
    final oldId = old.message?.id;
    if (newId == oldId) return;

    if (newId == null) {
      // Fade out, then clear _shown
      _ctrl.reverse().then((_) {
        if (!mounted) return;
        setState(() => _shown = null);
      });
    } else if (_shown == null) {
      // Was empty — set new message and fade in
      setState(() => _shown = widget.message);
      _ctrl.forward();
    } else {
      // Fade out current bubble, swap, then fade in new bubble.
      // Single GlassContainer on screen at a time → its BackdropFilter
      // glass blur is composited as one layer and fades as a unit.
      _ctrl.reverse().then((_) {
        if (!mounted) return;
        setState(() => _shown = widget.message);
        _ctrl.forward();
      });
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Agent avatar — matches bubble height
          GlassContainer(
            width: 52,
            height: 52,
            shape: const LiquidRoundedSuperellipse(borderRadius: 999),
            settings: GlassConfig.interactive,
            child: const Center(
              child: Text('😊', style: TextStyle(fontSize: 22)),
            ),
          ),
          const SizedBox(width: 12),
          // Agent message bubble — fades as a single unit (glass frame + text)
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72,
              ),
              child: FadeTransition(
                opacity: _ctrl,
                child: _shown != null
                    ? GlassContainer(
                        shape: const LiquidRoundedSuperellipse(borderRadius: 16),
                        settings: GlassConfig.card,
                        padding: const EdgeInsets.all(14),
                        // Reuse DiaryText for the line-by-line left-to-right
                        // sweep so the AI's message reveals with the same
                        // writing feel as the user's diary input. Keyed by
                        // message id so a new message gets a fresh
                        // AnimationController and starts a new sweep.
                        child: DiaryText(
                          _shown!.content,
                          key: ValueKey(_shown!.id),
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.onSurface,
                            fontSize: 15,
                            height: 1.5,
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
