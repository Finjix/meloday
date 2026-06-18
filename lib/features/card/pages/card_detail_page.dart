import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';
import '../../../core/theme.dart';
import '../../../models/music_card.dart';
import '../../diary/providers/diary_list_provider.dart';
import '../providers/music_card_provider.dart';
import '../widgets/music_player.dart';

class CardDetailPage extends ConsumerWidget {
  final String cardId;

  const CardDetailPage({super.key, required this.cardId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardAsync = ref.watch(musicCardProvider(cardId));

    return cardAsync.when(
      loading: () => Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: _buildAppBar(context, ref, null),
        body: Center(
          child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary),
        ),
      ),
      error: (error, _) => Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        appBar: _buildAppBar(context, ref, null),
        body: Center(
          child: Text(
            '加载失败: $error',
            style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ),
      ),
      data: (card) {
        if (card == null) {
          return Scaffold(
            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
            appBar: _buildAppBar(context, ref, null),
            body: Center(
              child: Text(
                '卡片未找到',
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
            ),
          );
        }
        return _buildContent(context, ref, card);
      },
    );
  }

  AppBar _buildAppBar(BuildContext context, WidgetRef ref, MusicCard? card) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back_rounded, color: Theme.of(context).colorScheme.onSurface),
        onPressed: () => Navigator.of(context).pop(),
      ),
      actions: [
        if (card != null) ...[
          IconButton(
            icon: Icon(Icons.edit_rounded, color: Theme.of(context).colorScheme.onSurface),
            tooltip: '重命名',
            onPressed: () => _showRenameDialog(context, ref, card),
          ),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded,
                color: Theme.of(context).colorScheme.primary),
            tooltip: '删除',
            onPressed: () => _showDeleteDialog(context, ref, card),
          ),
        ],
      ],
    );
  }

  Scaffold _buildContent(BuildContext context, WidgetRef ref, MusicCard card) {
    final moodColor = AppTheme.moodColorFromHex(card.moodColor);
    final dateFormatted =
        DateFormat('yyyy年M月d日 HH:mm', 'zh_CN').format(card.createdAt);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: _buildAppBar(context, ref, card),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Cover image area ──────────────────────────────────────
            _buildCoverArea(context, moodColor),
            const SizedBox(height: 24),
            // ── Card name ─────────────────────────────────────────────
            Text(
              card.name,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            // ── Date ──────────────────────────────────────────────────
            Text(
              dateFormatted,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontSize: 14,
                fontFamily: AppTheme.diaryFontFamily,
              ),
            ),
            const SizedBox(height: 16),
            // ── Summary ───────────────────────────────────────────────
            Text(
              card.summary,
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 16,
                height: 1.6,
                fontFamily: AppTheme.diaryFontFamily,
              ),
            ),
            const SizedBox(height: 24),
            // ── Full diary button ─────────────────────────────────────
            GlassContainer(
              shape:
                  const LiquidRoundedSuperellipse(borderRadius: 16),
              settings: GlassConfig.card,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => _showFullDiarySheet(context, card),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 14),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.menu_book_rounded,
                          color: moodColor, size: 22),
                      const SizedBox(width: 10),
                      Text(
                        '查看完整日记',
                        style: TextStyle(
                          color: moodColor,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            // ── Music player ──────────────────────────────────────────
            MusicPlayer(assetPath: card.musicFile),
            const SizedBox(height: 24),
            // ── Tags ──────────────────────────────────────────────────
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: card.tags.map((tag) => _buildTag(context, tag, moodColor)).toList(),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // ── Cover area ──────────────────────────────────────────────────────
  Widget _buildCoverArea(BuildContext context, Color moodColor) {
    final gradientColors = AppTheme.gradientPairFromMood(moodColor);

    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 16),
      settings: GlassConfig.surface,
      child: Container(
        height: 160,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: gradientColors,
          ),
        ),
        child: Center(
          child: Text(
            '🎵',
            style: TextStyle(fontSize: 56, color: Colors.white.withValues(alpha: 0.9)),
          ),
        ),
      ),
    );
  }

  // ── Tag chip ────────────────────────────────────────────────────────
  Widget _buildTag(BuildContext context, String label, Color moodColor) {
    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 16),
      settings: GlassConfig.tag,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: Text(
        '#$label',
        style: TextStyle(
          color: moodColor.withValues(alpha: 0.9),
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  // ── Rename dialog ───────────────────────────────────────────────────
  Future<void> _showRenameDialog(
      BuildContext context, WidgetRef ref, MusicCard card) async {
    final controller = TextEditingController(text: card.name);
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        title: Text(
          '重命名音乐卡片',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
          decoration: InputDecoration(
            hintText: '输入新名称',
            hintStyle: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                  color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  BorderSide(color: Theme.of(context).colorScheme.primary),
            ),
            filled: true,
            fillColor: Theme.of(context).scaffoldBackgroundColor,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              '取消',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
          TextButton(
            onPressed: () async {
              final newName = controller.text.trim();
              if (newName.isNotEmpty && newName != card.name) {
                await ref
                    .read(diaryListProvider.notifier)
                    .renameCard(card.id, newName);
                ref.invalidate(musicCardProvider(card.id));
              }
              if (ctx.mounted) Navigator.of(ctx).pop();
            },
            child: Text(
              '确认',
              style: TextStyle(color: Theme.of(context).colorScheme.primary),
            ),
          ),
        ],
      ),
    );
    controller.dispose();
  }

  // ── Delete confirmation dialog ──────────────────────────────────────
  void _showDeleteDialog(
      BuildContext context, WidgetRef ref, MusicCard card) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
        title: Text(
          '删除音乐卡片',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
        content: Text(
          '确定要删除这张音乐卡片吗？此操作不可撤销。',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              '取消',
              style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
            ),
          ),
          TextButton(
            onPressed: () async {
              await ref.read(diaryListProvider.notifier).deleteCard(card.id);
              if (ctx.mounted) Navigator.of(ctx).pop();
              if (context.mounted) Navigator.of(context).pop();
            },
            child: Text(
              '删除',
              style: TextStyle(color: Theme.of(context).colorScheme.primary),
            ),
          ),
        ],
      ),
    );
  }

  // ── Full diary bottom sheet ────────────────────────────────────────
  void _showFullDiarySheet(BuildContext context, MusicCard card) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.7,
        minChildSize: 0.3,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, scrollController) {
          return GlassContainer(
            shape: const LiquidRoundedSuperellipse(borderRadius: 16),
            settings: GlassConfig.sheet,
            margin: const EdgeInsets.all(8),
            child: Column(
              children: [
                // ── Drag handle ──────────────────────────────────────
                const SizedBox(height: 12),
                Container(
                  width: 40,
                  height: 5,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(height: 16),
                // ── Title ────────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    children: [
                      Text(
                        '📖 完整日记',
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurface,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // ── Content ──────────────────────────────────────────
                Expanded(
                  child: SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Text(
                      card.fullContent,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurface,
                        fontSize: 15,
                        height: 1.8,
                        fontFamily: AppTheme.diaryFontFamily,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          );
        },
    ));
  }
}
