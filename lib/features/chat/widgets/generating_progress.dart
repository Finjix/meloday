// lib/features/chat/widgets/generating_progress.dart
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../models/generating_progress.dart';

class GeneratingProgressWidget extends StatelessWidget {
  final GeneratingProgress progress;

  const GeneratingProgressWidget({super.key, required this.progress});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 999),
      settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Text('🎵', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Text(
                '正在为你创作...',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 14,
                ),
              ),
              const Spacer(),
              Text(
                '${progress.currentStep}/${progress.totalSteps}',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            progress.stepName,
            style: TextStyle(
              color: Theme.of(context).colorScheme.primary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress.percent,
              backgroundColor: Colors.white.withValues(alpha: 0.1),
              valueColor: AlwaysStoppedAnimation<Color>(Theme.of(context).colorScheme.primary),
              minHeight: 4,
            ),
          ),
        ],
      ),
    );
  }
}
