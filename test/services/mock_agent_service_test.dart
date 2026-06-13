import 'package:flutter_test/flutter_test.dart';
import 'package:meloday/services/mock_agent_service.dart';

void main() {
  group('MockAgentService', () {
    late MockAgentService service;

    setUp(() {
      service = MockAgentService();
    });

    test('greeting should return non-empty message', () {
      final greeting = service.getGreeting();
      expect(greeting, isNotEmpty);
    });

    test('should track message count and determine completeness', () {
      expect(service.isInfoComplete(0, 0), false);
      expect(service.isInfoComplete(2, 1), false);
      expect(service.isInfoComplete(2, 2), false);
      expect(service.isInfoComplete(2, 3), true);
      expect(service.isInfoComplete(3, 3), true);
      expect(service.isInfoComplete(1, 3), false);
    });

    test('getResponse should return a non-empty string', () {
      final response = service.getResponse('今天吃了好吃的');
      expect(response, isNotEmpty);
    });
  });
}
