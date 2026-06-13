import 'package:hive_flutter/hive_flutter.dart';
import '../models/music_card.dart';

class StorageService {
  static const String _boxName = 'cards';
  Box<String>? _box;

  Future<void> init() async {
    await Hive.initFlutter();
    _box = await Hive.openBox<String>(_boxName);
  }

  /// For tests: use in-memory Hive
  Future<void> initForTest() async {
    Hive.init('test_hive');
    _box = await Hive.openBox<String>('test_cards');
    await _box?.clear();
  }

  Future<void> saveCard(MusicCard card) async {
    await _box?.put(card.id, _serialize(card));
  }

  Future<List<MusicCard>> getAllCards() async {
    final cards = <MusicCard>[];
    for (final key in _box!.keys) {
      final json = _box!.get(key);
      if (json != null) cards.add(_deserialize(json));
    }
    cards.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return cards;
  }

  Future<MusicCard?> getCard(String id) async {
    final json = _box?.get(id);
    if (json == null) return null;
    return _deserialize(json);
  }

  Future<void> deleteCard(String id) async {
    await _box?.delete(id);
  }

  Future<void> updateCardName(String id, String newName) async {
    final card = await getCard(id);
    if (card != null) {
      await saveCard(card.copyWith(name: newName));
    }
  }

  String _serialize(MusicCard card) {
    return '${card.id}||${card.name}||${card.summary}||${card.fullContent}||${card.coverImage}||${card.musicFile}||${card.createdAt.toIso8601String()}||${card.tags.join(',')}||${card.moodColor}';
  }

  MusicCard _deserialize(String raw) {
    final parts = raw.split('||');
    return MusicCard(
      id: parts[0],
      name: parts[1],
      summary: parts[2],
      fullContent: parts[3],
      coverImage: parts[4],
      musicFile: parts[5],
      createdAt: DateTime.parse(parts[6]),
      tags: parts[7].isEmpty ? [] : parts[7].split(','),
      moodColor: parts[8],
    );
  }
}
