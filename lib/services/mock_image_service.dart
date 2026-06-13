import '../models/mood_colors.dart';

class MockImageService {
  static const _keywordToImage = {
    '妈妈': 'assets/images/family.jpg',
    '烤鹅': 'assets/images/food.jpg',
    '吃': 'assets/images/food.jpg',
    '朋友': 'assets/images/friends.jpg',
    '雨': 'assets/images/rain.jpg',
    '旅行': 'assets/images/travel.jpg',
    '咖啡': 'assets/images/cafe.jpg',
    '跑步': 'assets/images/running.jpg',
    '音乐': 'assets/images/music.jpg',
    '花': 'assets/images/nature.jpg',
    '山': 'assets/images/nature.jpg',
    '海': 'assets/images/ocean.jpg',
  };

  Future<String> fetchImage({
    required List<String> tags,
    required String userMessages,
  }) async {
    await Future.delayed(const Duration(milliseconds: 800));

    final lower = userMessages.toLowerCase();
    for (final entry in _keywordToImage.entries) {
      if (lower.contains(entry.key)) {
        return entry.value;
      }
    }
    return 'assets/images/default.jpg';
  }
}
