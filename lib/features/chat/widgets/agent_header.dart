// lib/features/chat/widgets/agent_header.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../models/chat_message.dart';

class AgentHeader extends StatelessWidget {
  final ChatMessage? message;

  const AgentHeader({super.key, this.message});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Agent avatar — circular glass container
          GlassContainer(
            width: 48,
            height: 48,
            shape: LiquidOval(
              side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
            ),
            settings: isDark ? GlassConfig.darkInteractive : GlassConfig.interactive,
            child: const Center(
              child: Text('🤖', style: TextStyle(fontSize: 24)),
            ),
          ),
          const SizedBox(width: 12),
          // Agent message bubble
          Expanded(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 300),
              child: message != null
                  ? GlassContainer(
                      key: ValueKey(message!.id),
                      shape: const LiquidRoundedSuperellipse(borderRadius: 16),
                      settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
                      padding: const EdgeInsets.all(14),
                      child: Text(
                        message!.content,
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
        ],
      ),
    );
  }
}
