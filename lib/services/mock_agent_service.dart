import 'dart:math';

class MockAgentService {
  final _random = Random();

  int _agentRound = 0;

  static const _greetings = [
    '嗨！今天过得怎么样？有什么想和我分享的吗？ 🌸',
    '你好呀～今天有什么故事想要记录下来吗？ ✨',
    '欢迎回来！今天的心情如何？说来听听吧 🎵',
  ];

  static const _followUps = [
    '听起来很有意思呢，当时你的心情是怎样的？',
    '能再多说一些细节吗？我想更了解那一刻的你～',
    '这件事给你带来了什么样的感受呢？',
    '那是什么样的感觉？像某种颜色或者旋律吗？',
    '如果可以给这一刻配上一段音乐，你希望是什么风格？',
    '除了这件事，今天还有什么让你印象深刻的小瞬间吗？',
    '你希望今天的音乐是什么情绪基调呢？温暖的、欢快的，还是平静的？',
    '真好，能感受到你的心情。还有其他想说的吗？',
    '我好像能理解那种感觉了～再和我多说一点吧',
  ];

  String getGreeting() {
    _agentRound = 0;
    return _greetings[_random.nextInt(_greetings.length)];
  }

  String getResponse(String userMessage) {
    _agentRound++;
    if (_agentRound < _followUps.length) {
      return _followUps[_agentRound - 1];
    }
    return _followUps[_random.nextInt(_followUps.length)];
  }

  bool isInfoComplete(int userMessageCount, int agentRounds) {
    return userMessageCount >= 2 && agentRounds >= 3;
  }

  void reset() {
    _agentRound = 0;
  }
}
