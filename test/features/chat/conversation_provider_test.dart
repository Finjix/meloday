import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:meloday/features/chat/providers/conversation_provider.dart';
import 'package:meloday/models/chat_message.dart';
import 'package:meloday/models/conversation_state.dart';
import 'package:meloday/services/storage_service.dart';
import 'package:meloday/main.dart';

Future<ProviderContainer> createTestContainer() async {
  final storageService = StorageService();
  await storageService.initForTest();
  return ProviderContainer(
    overrides: [
      storageServiceProvider.overrideWithValue(storageService),
    ],
  );
}

void main() {
  group('ConversationProvider', () {
    test('initial state should be idle', () async {
      final container = await createTestContainer();
      final state = container.read(conversationProvider);

      expect(state.status, ConvStatus.idle);
      expect(state.userMessages, isEmpty);
      expect(state.agentMessage, isNull);
    });

    test('startConversation should transition to greeting', () async {
      final container = await createTestContainer();
      container.read(conversationProvider.notifier).startConversation();

      final state = container.read(conversationProvider);
      expect(state.status, ConvStatus.greeting);
      expect(state.agentMessage, isNotNull);
      expect(state.agentMessage!.sender, Sender.agent);
    });

    test('sendMessage in greeting should transition to chatting', () async {
      final container = await createTestContainer();
      container.read(conversationProvider.notifier).startConversation();

      await container.read(conversationProvider.notifier).sendMessage('今天吃了好吃的');

      final state = container.read(conversationProvider);
      expect(state.status, ConvStatus.chatting);
      expect(state.userMessages.length, 1);
    });
  });
}
