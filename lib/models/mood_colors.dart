class MoodColors {
  static const Map<String, String> tagToColor = {
    '温暖': '#FF8C42',
    '快乐': '#FFD93D',
    '平静': '#6EC6A0',
    '伤感': '#7B8FCC',
    '浪漫': '#E88DAA',
    '怀旧': '#C4A882',
    '思念': '#8BA4D6',
  };

  static const String defaultColor = '#A0A0B0';

  static String fromTags(List<String> tags) {
    for (final tag in tags) {
      if (tagToColor.containsKey(tag)) return tagToColor[tag]!;
    }
    return defaultColor;
  }
}
