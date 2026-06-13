import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/music_card.dart';
import '../../../services/storage_service.dart';
import '../../../main.dart';

final diaryListProvider =
    StateNotifierProvider<DiaryListNotifier, AsyncValue<List<MusicCard>>>((ref) {
  return DiaryListNotifier(storageService: ref.watch(storageServiceProvider));
});

class DiaryListNotifier extends StateNotifier<AsyncValue<List<MusicCard>>> {
  final StorageService _storageService;

  DiaryListNotifier({required StorageService storageService})
      : _storageService = storageService,
        super(const AsyncValue.loading()) {
    loadCards();
  }

  Future<void> loadCards() async {
    state = const AsyncValue.loading();
    try {
      final cards = await _storageService.getAllCards();
      state = AsyncValue.data(cards);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> deleteCard(String id) async {
    await _storageService.deleteCard(id);
    await loadCards();
  }

  Future<void> renameCard(String id, String newName) async {
    await _storageService.updateCardName(id, newName);
    await loadCards();
  }
}
