import 'dart:convert';
import 'dart:io';

import 'package:hive_flutter/hive_flutter.dart';
import '../models/music_card.dart';

class StorageService {
  static const String _cardsBoxName = 'cards';
  static const String _settingsBoxName = 'settings';
  static const String _themeColorKey = 'themeColor';
  static bool _hiveInitialized = false;
  Box<String>? _cardsBox;
  Box<String>? _settingsBox;

  Future<void> init() async {
    if (!_hiveInitialized) {
      await Hive.initFlutter();
      _hiveInitialized = true;
    }
    _cardsBox = await Hive.openBox<String>(_cardsBoxName);
    _settingsBox = await Hive.openBox<String>(_settingsBoxName);
  }

  /// For tests: initializes Hive once with a unique temp directory,
  /// then opens a fresh box cleared of any prior test data.
  Future<void> initForTest() async {
    if (!_hiveInitialized) {
      final tempDir = Directory.systemTemp.createTempSync('meloday_test_');
      Hive.init(tempDir.path);
      _hiveInitialized = true;
    }
    _cardsBox = await Hive.openBox<String>('test_cards');
    await _cardsBox?.clear();
    _settingsBox = await Hive.openBox<String>('test_settings');
    await _settingsBox?.clear();
  }

  // ── Card CRUD ─────────────────────────────────────────────────────

  Future<void> saveCard(MusicCard card) async {
    await _cardsBox?.put(card.id, _serialize(card));
  }

  Future<List<MusicCard>> getAllCards() async {
    final cards = <MusicCard>[];
    for (final key in _cardsBox?.keys ?? <dynamic>[]) {
      final json = _cardsBox?.get(key);
      if (json != null) cards.add(_deserialize(json));
    }
    cards.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return cards;
  }

  Future<MusicCard?> getCard(String id) async {
    final json = _cardsBox?.get(id);
    if (json == null) return null;
    return _deserialize(json);
  }

  Future<void> deleteCard(String id) async {
    await _cardsBox?.delete(id);
  }

  Future<void> updateCardName(String id, String newName) async {
    final card = await getCard(id);
    if (card != null) {
      await saveCard(card.copyWith(name: newName));
    }
  }

  // ── Theme colour ──────────────────────────────────────────────────

  Future<void> saveThemeColor(String hex) async {
    await _settingsBox?.put(_themeColorKey, hex);
  }

  Future<String?> loadThemeColor() async {
    return _settingsBox?.get(_themeColorKey);
  }

  // ── Serialization ─────────────────────────────────────────────────

  String _serialize(MusicCard card) {
    return jsonEncode(card.toJson());
  }

  MusicCard _deserialize(String raw) {
    return MusicCard.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }
}
