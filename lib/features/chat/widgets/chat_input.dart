// lib/features/chat/widgets/chat_input.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../models/conversation_state.dart';
import '../../chat/providers/conversation_provider.dart';

// ── ChatFab ────────────────────────────────────────────────────────────
/// 60 px glass circle. Icon depends on state:
/// - collapsed → ✎ (edit) — tap to expand
/// - expanded + empty → ✕ (close) — tap to dismiss
/// - expanded + has text → ✓ (send) — tap to send
class ChatFab extends StatelessWidget {
  final bool isExpanded;
  final bool hasText;
  final VoidCallback onTap;

  const ChatFab({
    super.key,
    required this.isExpanded,
    required this.hasText,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.onSurfaceVariant;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: GlassContainer(
        shape: const LiquidRoundedSuperellipse(borderRadius: 999),
        settings: GlassConfig.navBar,
        padding: const EdgeInsets.all(18),
        child: SizedBox.square(
          dimension: 30,
          child: Stack(
            children: [
              // ✎ — only when collapsed
              Opacity(
                opacity: isExpanded ? 0 : 1,
                child: Icon(Icons.edit_rounded, size: 30, color: color),
              ),
              // ✕ — expanded + empty
              Opacity(
                opacity: (isExpanded && !hasText) ? 1 : 0,
                child: Icon(Icons.close_rounded, size: 30, color: color),
              ),
              // ✓ — expanded + has text
              Opacity(
                opacity: (isExpanded && hasText) ? 1 : 0,
                child: Icon(Icons.check_rounded, size: 30, color: color),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── InputPanel ─────────────────────────────────────────────────────────
/// Text input that replaces the nav bar when expanded.
///
/// Does NOT include a send button — the [ChatFab] handles that.
class InputPanel extends ConsumerStatefulWidget {
  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onChanged;

  const InputPanel({
    super.key,
    required this.controller,
    required this.onSend,
    required this.onChanged,
  });

  @override
  ConsumerState<InputPanel> createState() => _InputPanelState();
}

class _InputPanelState extends ConsumerState<InputPanel> {
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isGenerating =
        ref.watch(conversationProvider).status == ConvStatus.generating;

    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 16),
      settings: GlassConfig.navBar,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: TextField(
        controller: widget.controller,
        focusNode: _focusNode,
        enabled: !isGenerating,
        autofocus: false,
        maxLines: 8,
        minLines: 8,
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
        onChanged: (_) => widget.onChanged(),
        onSubmitted: (_) => widget.onSend(),
      ),
    );
  }
}
