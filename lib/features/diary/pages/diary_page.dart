// lib/features/diary/pages/diary_page.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/diary_list_provider.dart';
import '../widgets/timeline_list.dart';

/// Diary page showing all music cards in a timeline view.
///
/// Watches [diaryListProvider] and renders the appropriate state:
/// loading spinner, error with retry, or the [TimelineList] with cards.
class DiaryPage extends ConsumerWidget {
  const DiaryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(diaryListProvider);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: cardsAsync.when(
          loading: () => Center(
            child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
          ),
          error: (error, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '加载失败: $error',
                  style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () =>
                      ref.read(diaryListProvider.notifier).loadCards(),
                  child: Text(
                    '重试',
                    style: TextStyle(color: Theme.of(context).colorScheme.primary),
                  ),
                ),
              ],
            ),
          ),
          data: (cards) => TimelineList(
            cards: cards,
            onCardTap: (cardId) =>
                Navigator.pushNamed(context, '/card', arguments: cardId),
            onDelete: (cardId) =>
                ref.read(diaryListProvider.notifier).deleteCard(cardId),
          ),
        ),
      ),
    );
  }
}
