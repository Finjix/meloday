import 'generating_progress.dart';

enum Sender { user, agent }

enum MessageType { text, progress, card }

class ChatMessage {
  final String id;
  final String content;
  final Sender sender;
  final DateTime timestamp;
  final MessageType type;
  final GeneratingProgress? progress;
  final String? cardId;

  const ChatMessage({
    required this.id,
    required this.content,
    required this.sender,
    required this.timestamp,
    this.type = MessageType.text,
    this.progress,
    this.cardId,
  });
}
