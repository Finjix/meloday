import 'package:flutter_test/flutter_test.dart';
import 'package:meloday/models/music_card.dart';

void main() {
  group('MusicCard', () {
    test('should create with required fields', () {
      final card = MusicCard(
        id: 'test-id',
        name: '妈妈的味道',
        summary: '妈妈的烤鹅腿很香',
        fullContent: '今天回家，妈妈做了烤鹅腿...',
        coverImage: 'assets/images/food.jpg',
        musicFile: 'assets/music/test.mp3',
        createdAt: DateTime(2026, 6, 13),
        tags: ['温暖', '亲情'],
        moodColor: '#FF8C42',
      );

      expect(card.id, 'test-id');
      expect(card.name, '妈妈的味道');
      expect(card.tags, ['温暖', '亲情']);
    });

    test('copyWith should create a copy with updated name', () {
      final card = MusicCard(
        id: 'test-id',
        name: '原始名字',
        summary: '摘要',
        fullContent: '完整内容',
        coverImage: 'cover.jpg',
        musicFile: 'music.mp3',
        createdAt: DateTime.now(),
        tags: [],
        moodColor: '#A0A0B0',
      );

      final newCard = card.copyWith(name: '新名字');
      expect(card.name, '原始名字');
      expect(newCard.name, '新名字');
    });
  });
}
