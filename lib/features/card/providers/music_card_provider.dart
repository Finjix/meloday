import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/music_card.dart';
import '../../../main.dart';

final musicCardProvider =
    FutureProvider.family<MusicCard?, String>((ref, cardId) async {
  final storage = ref.watch(storageServiceProvider);
  return storage.getCard(cardId);
});
