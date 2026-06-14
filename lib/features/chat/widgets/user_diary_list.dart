// lib/features/chat/widgets/user_diary_list.dart
import 'package:flutter/material.dart';
import '../../../models/chat_message.dart';

class UserDiaryList extends StatelessWidget {
  final List<ChatMessage> messages;
  final ScrollController? scrollController;

  const UserDiaryList({
    super.key,
    required this.messages,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    if (messages.isEmpty) {
      return const SizedBox.shrink();
    }

    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 4),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final msg = messages[index];
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Text(
            msg.content,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 17,
              height: 1.8,
            ),
          ),
        );
      },
    );
  }
}
