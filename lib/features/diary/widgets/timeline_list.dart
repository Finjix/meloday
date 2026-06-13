// lib/features/diary/widgets/timeline_list.dart
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../../models/music_card.dart';
import '../../../core/theme.dart';
import '../../card/widgets/music_card_compact.dart';

/// A timeline list that groups [MusicCard]s by date and displays them in a
/// vertical timeline layout with swipe-to-delete support.
class TimelineList extends StatelessWidget {
  final List<MusicCard> cards;
  final void Function(String cardId) onCardTap;
  final void Function(String cardId) onDelete;

  const TimelineList({
    super.key,
    required this.cards,
    required this.onCardTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const _EmptyState();
    return _TimelineContent(
      cards: cards,
      onCardTap: onCardTap,
      onDelete: onDelete,
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '还没有日记',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.8),
              fontSize: 17,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '去首页写一篇吧',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.7),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Timeline content
// ──────────────────────────────────────────────────────────────────────────────

class _TimelineContent extends StatelessWidget {
  final List<MusicCard> cards;
  final void Function(String cardId) onCardTap;
  final void Function(String cardId) onDelete;

  const _TimelineContent({
    required this.cards,
    required this.onCardTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final grouped = _groupByDate(cards);
    final dateKeys = grouped.keys.toList()..sort((a, b) => b.compareTo(a));
    final todayKey = DateFormat('yyyy-MM-dd').format(DateTime.now());

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      itemCount: dateKeys.length,
      itemBuilder: (context, index) {
        final dateKey = dateKeys[index];
        final cardsForDate = grouped[dateKey]!;
        final isLast = index == dateKeys.length - 1;
        final dateLabel = dateKey == todayKey
            ? '今天'
            : DateFormat('M月d日').format(DateTime.parse(dateKey));
        final moodColor =
            AppTheme.moodColorFromHex(cardsForDate.first.moodColor);

        return _TimelineRow(
          dateLabel: dateLabel,
          cardsForDate: cardsForDate,
          moodColor: moodColor,
          isLast: isLast,
          onCardTap: onCardTap,
          onDelete: onDelete,
        );
      },
    );
  }

  Map<String, List<MusicCard>> _groupByDate(List<MusicCard> cards) {
    final grouped = <String, List<MusicCard>>{};
    for (final card in cards) {
      final dateKey = DateFormat('yyyy-MM-dd').format(card.createdAt);
      grouped.putIfAbsent(dateKey, () => []).add(card);
    }
    return grouped;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Single timeline row (dot + line + date label + cards)
// ──────────────────────────────────────────────────────────────────────────────

class _TimelineRow extends StatelessWidget {
  final String dateLabel;
  final List<MusicCard> cardsForDate;
  final Color moodColor;
  final bool isLast;
  final void Function(String cardId) onCardTap;
  final void Function(String cardId) onDelete;

  const _TimelineRow({
    required this.dateLabel,
    required this.cardsForDate,
    required this.moodColor,
    required this.isLast,
    required this.onCardTap,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Left column: timeline dot + vertical line ────────────
          SizedBox(
            width: 40,
            child: Column(
              children: [
                const SizedBox(height: 6),
                Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: moodColor,
                    shape: BoxShape.circle,
                  ),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 1,
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
              ],
            ),
          ),
          // ── Right column: date label + card list ─────────────────
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 2),
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    dateLabel,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                ...cardsForDate.map(
                  (card) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Dismissible(
                      key: Key('timeline_dismiss_${card.id}'),
                      direction: DismissDirection.endToStart,
                      confirmDismiss: (_) async {
                        onDelete(card.id);
                        return false; // Let the provider handle removal
                      },
                      background: Container(
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: MusicCardCompact(
                        card: card,
                        onTap: () => onCardTap(card.id),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
