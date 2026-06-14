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
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Agent avatar — pill shape on the left
          GlassContainer(
            width: 55,
            height: 55,
            shape: const LiquidRoundedSuperellipse(borderRadius: 999),
            settings: GlassConfig.interactive,
            child: const Center(
              child: Text('😊', style: TextStyle(fontSize: 24)),
            ),
          ),
          const SizedBox(width: 12),
          // Agent message bubble — adapts to content width
          Flexible(
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.72,
              ),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 300),
                child: message != null
                    ? GlassContainer(
                        key: ValueKey(message!.id),
                        shape: const LiquidRoundedSuperellipse(borderRadius: 16),
                        settings: GlassConfig.card,
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
          ),
        ],
      ),
    );
  }
}
