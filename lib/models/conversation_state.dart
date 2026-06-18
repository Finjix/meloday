import 'chat_message.dart';
import 'generating_progress.dart';
import 'music_card.dart';

enum ConvStatus { idle, greeting, chatting, generating, cardReady, error }

class ConversationState {
  final ConvStatus status;
  final List<ChatMessage> userMessages;
  final ChatMessage? agentMessage;
  final GeneratingProgress? progress;
  final MusicCard? currentCard;
  final String? errorMessage;

  /// Whether the user has ever tapped the compose FAB to expand the input.
  final bool hasExpandedInput;

  const ConversationState({
    this.status = ConvStatus.idle,
    this.userMessages = const [],
    this.agentMessage,
    this.progress,
    this.currentCard,
    this.errorMessage,
    this.hasExpandedInput = false,
  });

  ConversationState copyWith({
    ConvStatus? status,
    List<ChatMessage>? userMessages,
    ChatMessage? agentMessage,
    GeneratingProgress? progress,
    MusicCard? currentCard,
    String? errorMessage,
    bool clearAgent = false,
    bool clearProgress = false,
    bool clearCard = false,
    bool clearError = false,
    bool? hasExpandedInput,
  }) {
    return ConversationState(
      status: status ?? this.status,
      userMessages: userMessages ?? this.userMessages,
      agentMessage: clearAgent ? null : (agentMessage ?? this.agentMessage),
      progress: clearProgress ? null : (progress ?? this.progress),
      currentCard: clearCard ? null : (currentCard ?? this.currentCard),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      hasExpandedInput: hasExpandedInput ?? this.hasExpandedInput,
    );
  }
}
