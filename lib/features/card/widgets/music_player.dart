// lib/features/card/widgets/music_player.dart
import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:liquid_glass_widgets/liquid_glass_widgets.dart';
import '../../../core/glass_config.dart';

/// A glass morphism styled music player widget using audioplayers.
///
/// Features:
/// - Play/pause toggle button (circular glass container)
/// - Progress slider with glass morphism thumb
/// - Time labels (current position / total duration)
/// - Falls back cleanly if audio asset is not found
class MusicPlayer extends StatefulWidget {
  /// Path to the audio asset (e.g. 'assets/music/test.mp3').
  final String assetPath;

  const MusicPlayer({
    super.key,
    required this.assetPath,
  });

  @override
  State<MusicPlayer> createState() => _MusicPlayerState();
}

class _MusicPlayerState extends State<MusicPlayer> {
  final AudioPlayer _player = AudioPlayer();

  PlayerState _playerState = PlayerState.stopped;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _hasError = false;
  bool _isDisposed = false;

  StreamSubscription? _stateSub;
  StreamSubscription? _positionSub;
  StreamSubscription? _durationSub;

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  Future<void> _initPlayer() async {
    try {
      _stateSub = _player.onPlayerStateChanged.listen((state) {
        if (_isDisposed) return;
        setState(() => _playerState = state);
      });

      _positionSub = _player.onPositionChanged.listen((pos) {
        if (_isDisposed) return;
        setState(() => _position = pos);
      });

      _durationSub = _player.onDurationChanged.listen((dur) {
        if (_isDisposed) return;
        setState(() => _duration = dur);
      });

      await _player.setSource(AssetSource(widget.assetPath));
    } catch (_) {
      if (_isDisposed) return;
      setState(() => _hasError = true);
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    _stateSub?.cancel();
    _positionSub?.cancel();
    _durationSub?.cancel();
    _player.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    if (_hasError) return;
    if (_playerState == PlayerState.playing) {
      _player.pause();
    } else {
      _player.resume();
    }
  }

  String _formatDuration(Duration d) {
    final minutes = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  double get _sliderValue {
    if (_duration.inMilliseconds == 0) return 0.0;
    return _position.inMilliseconds / _duration.inMilliseconds;
  }

  void _onSliderChanged(double value) {
    if (_hasError || _duration.inMilliseconds == 0) return;
    final newPosition = Duration(
      milliseconds: (value * _duration.inMilliseconds).round(),
    );
    _player.seek(newPosition);
  }

  @override
  Widget build(BuildContext context) {
    final isPlaying = _playerState == PlayerState.playing;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GlassContainer(
      shape: const LiquidRoundedSuperellipse(borderRadius: 20),
      settings: isDark ? GlassConfig.darkCard : GlassConfig.card,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Progress slider ─────────────────────────────────────────
          if (_hasError)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                '音频加载失败',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
            )
          else
            Row(
              children: [
                Text(
                  _formatDuration(_position),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 11,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                Expanded(
                  child: GlassSlider(
                    value: _sliderValue,
                    onChanged: _onSliderChanged,
                    activeColor: Theme.of(context).colorScheme.primary,
                    inactiveColor: Colors.white.withValues(alpha: 0.15),
                    thumbColor: Theme.of(context).colorScheme.primary,
                    trackHeight: 4,
                    thumbRadius: 12,
                  ),
                ),
                Text(
                  _formatDuration(_duration),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                    fontSize: 11,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          const SizedBox(height: 14),
          // ── Play / pause button ──────────────────────────────────────
          GlassButton.custom(
            onTap: _togglePlayPause,
            width: 64,
            height: 64,
            shape: const LiquidOval(
              side: BorderSide(color: GlassConfig.buttonRimWhite),
            ),
            settings: isDark ? GlassConfig.darkInteractive : GlassConfig.interactive,
            useOwnLayer: true,
            glowColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.3),
            glowRadius: 1.2,
            interactionScale: 1.08,
            child: Icon(
              isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
              color: Theme.of(context).colorScheme.primary,
              size: 32,
            ),
          ),
        ],
      ),
    );
  }
}
