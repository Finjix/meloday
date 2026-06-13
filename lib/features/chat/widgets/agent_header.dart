// lib/features/chat/widgets/agent_header.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../models/chat_message.dart';
import '../../../core/theme.dart';

class AgentHeader extends StatelessWidget {
  final ChatMessage? message;

  const AgentHeader({super.key, this.message});

  @override
  Widget build(BuildContext context) {
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
            settings: const LiquidGlassSettings(blur: 10),
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
                      settings: const LiquidGlassSettings(blur: 8),
                      padding: const EdgeInsets.all(14),
                      child: Text(
                        message!.content,
                        style: const TextStyle(
                          color: AppTheme.textPrimary,
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
