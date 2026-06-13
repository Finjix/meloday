import 'package:flutter_test/flutter_test.dart';
import 'package:meloday/models/music_card.dart';
import 'package:meloday/services/storage_service.dart';

void main() {
  group('StorageService', () {
    test('saveCard and getAllCards should work', () async {
      final service = StorageService();
      await service.initForTest();

      final card = MusicCard(
        id: 'test-1',
        name: '测试卡片',
        summary: '测试摘要',
        fullContent: '测试完整内容',
        coverImage: 'cover.jpg',
        musicFile: 'music.mp3',
        createdAt: DateTime(2026, 6, 13),
        tags: ['温暖'],
        moodColor: '#FF8C42',
      );

      await service.saveCard(card);
      final cards = await service.getAllCards();

      expect(cards.length, 1);
      expect(cards.first.id, 'test-1');
    });

    test('deleteCard should remove card', () async {
      final service = StorageService();
      await service.initForTest();

      await service.saveCard(MusicCard(
        id: 'test-2',
        name: '待删除',
        summary: '摘要',
        fullContent: '完整',
        coverImage: 'c.jpg',
        musicFile: 'm.mp3',
        createdAt: DateTime.now(),
        tags: [],
        moodColor: '#A0A0B0',
      ));

      await service.deleteCard('test-2');
      final cards = await service.getAllCards();
      expect(cards.length, 0);
    });

    test('updateCardName should rename card', () async {
      final service = StorageService();
      await service.initForTest();

      await service.saveCard(MusicCard(
        id: 'test-3',
        name: '旧名字',
        summary: '摘要',
        fullContent: '完整',
        coverImage: 'c.jpg',
        musicFile: 'm.mp3',
        createdAt: DateTime.now(),
        tags: [],
        moodColor: '#A0A0B0',
      ));

      await service.updateCardName('test-3', '新名字');
      final cards = await service.getAllCards();
      expect(cards.first.name, '新名字');
    });
  });
}
