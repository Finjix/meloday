class GeneratingProgress {
  final int currentStep;
  final int totalSteps;
  final String stepName;

  const GeneratingProgress({
    required this.currentStep,
    required this.totalSteps,
    required this.stepName,
  });

  static const List<String> stepNames = [
    '分析心情',
    '编写提示词',
    '生成音乐',
    '匹配封面',
  ];

  double get percent => currentStep / totalSteps;
}
