import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import 'app.dart';
import 'core/theme.dart';
import 'services/storage_service.dart';
import 'features/card/pages/card_detail_page.dart';

final storageServiceProvider = Provider<StorageService>((ref) {
  throw UnimplementedError('StorageService must be overridden in main');
});

/// The currently selected accent colour hex (e.g. `'#E88DAA'`).
/// Loaded from storage in [main] and overridden before the app runs.
final themeAccentProvider = StateProvider<String>((ref) {
  throw UnimplementedError('themeAccentProvider must be overridden in main');
});

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LiquidGlassWidgets.initialize();
  await LightweightLiquidGlass.preWarm();
  final storageService = StorageService();
  await storageService.init();
  final savedColor =
      await storageService.loadThemeColor() ?? AppTheme.defaultAccentHex;

  runApp(
    ProviderScope(
      overrides: [
        storageServiceProvider.overrideWithValue(storageService),
        themeAccentProvider.overrideWith((ref) => savedColor),
      ],
      child: const MainApp(),
    ),
  );
}

class MainApp extends ConsumerWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accentHex = ref.watch(themeAccentProvider);

    return MaterialApp(
      title: 'Meloday',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightThemeFromHex(accentHex),
      themeAnimationDuration: const Duration(milliseconds: 400),
      home: const AppShell(),
      onGenerateRoute: (settings) {
        if (settings.name == '/card') {
          final cardId = settings.arguments as String;
          return MaterialPageRoute(
            builder: (_) => CardDetailPage(cardId: cardId),
          );
        }
        return null;
      },
    );
  }
}
