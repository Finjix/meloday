// lib/features/chat/widgets/chat_input.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';

/// A rectangular glass container with a text field and send button,
/// centered on the page for diary-style input.
class ChatInput extends StatefulWidget {
  final bool enabled;
  final ValueChanged<String> onSend;

  const ChatInput({
    super.key,
    this.enabled = true,
    required this.onSend,
  });

  @override
  State<ChatInput> createState() => _ChatInputState();
}

class _ChatInputState extends State<ChatInput> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  void _handleSend() {
    final text = _controller.text.trim();
    if (text.isEmpty || !widget.enabled) return;
    widget.onSend(text);
    _controller.clear();
    _focusNode.requestFocus();
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 16),
      settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _controller,
            focusNode: _focusNode,
            enabled: widget.enabled,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 15,
              height: 1.6,
            ),
            decoration: InputDecoration(
              hintText: '写点什么吧...',
              hintStyle: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 15,
              ),
              border: InputBorder.none,
              contentPadding: EdgeInsets.zero,
            ),
            textInputAction: TextInputAction.newline,
            maxLines: 6,
            minLines: 3,
            autofocus: true,
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: IconButton(
              icon: Icon(
                Icons.send_rounded,
                color: widget.enabled
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.onSurfaceVariant,
              ),
              onPressed: widget.enabled ? _handleSend : null,
            ),
          ),
        ],
      ),
    );
  }
}
