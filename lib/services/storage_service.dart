import 'dart:convert';
import 'dart:io';

import 'package:hive_flutter/hive_flutter.dart';
import '../models/music_card.dart';

class StorageService {
  static const String _boxName = 'cards';
  static bool _hiveInitialized = false;
  Box<String>? _box;

  Future<void> init() async {
    if (!_hiveInitialized) {
      await Hive.initFlutter();
      _hiveInitialized = true;
    }
    _box = await Hive.openBox<String>(_boxName);
  }

  /// For tests: initializes Hive once with a unique temp directory,
  /// then opens a fresh box cleared of any prior test data.
  Future<void> initForTest() async {
    if (!_hiveInitialized) {
      final tempDir = Directory.systemTemp.createTempSync('meloday_test_');
      Hive.init(tempDir.path);
      _hiveInitialized = true;
    }
    _box = await Hive.openBox<String>('test_cards');
    await _box?.clear();
  }

  Future<void> saveCard(MusicCard card) async {
    await _box?.put(card.id, _serialize(card));
  }

  Future<List<MusicCard>> getAllCards() async {
    final cards = <MusicCard>[];
    for (final key in _box?.keys ?? <dynamic>[]) {
      final json = _box?.get(key);
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
