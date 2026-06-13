import 'dart:convert';

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
    for (final key in _box?.keys ?? <dynamic>[]) {
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
    return jsonEncode(card.toJson());
  }

  MusicCard _deserialize(String raw) {
    return MusicCard.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }
}
