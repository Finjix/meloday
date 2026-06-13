class MockMusicService {
  static const testMusicPath = 'assets/music/test.mp3';

  Future<String> generateMusic({
    required String prompt,
    required String mood,
  }) async {
    // Simulate generation delay
    await Future.delayed(const Duration(seconds: 2));
    return testMusicPath;
  }
}
