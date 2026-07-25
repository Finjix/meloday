"use client";

import { useCallback, useEffect, useRef } from "react";

export type AmbientSoundKind = "meditation" | "movement" | "rain" | "ocean" | "piano";

type AmbientRuntime = {
  context: AudioContext;
  master: GainNode;
  sources: AudioScheduledSourceNode[];
  timers: number[];
};

type AudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function stopRuntime(runtime: AmbientRuntime, fadeMs: number) {
  const now = runtime.context.currentTime;
  runtime.timers.forEach((timer) => window.clearInterval(timer));
  runtime.timers = [];

  runtime.master.gain.cancelScheduledValues(now);
  runtime.master.gain.setValueAtTime(Math.max(runtime.master.gain.value, 0.0001), now);
  runtime.master.gain.exponentialRampToValueAtTime(0.0001, now + fadeMs / 1000);

  window.setTimeout(() => {
    runtime.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // A source may already have completed its own envelope.
      }
    });
    void runtime.context.close();
  }, fadeMs + 80);
}

function createNoise(context: AudioContext) {
  const seconds = 4;
  const buffer = context.createBuffer(
    2,
    context.sampleRate * seconds,
    context.sampleRate,
  );

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    let previous = 0;
    for (let index = 0; index < data.length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.985 + white * 0.015;
      data[index] = previous * 3.2;
    }
  }

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function addNoiseBed(runtime: AmbientRuntime, kind: "rain" | "ocean" | "meditation") {
  const { context, master } = runtime;
  const source = createNoise(context);
  const filter = context.createBiquadFilter();
  const gain = context.createGain();

  if (kind === "rain") {
    filter.type = "highpass";
    filter.frequency.value = 850;
    gain.gain.value = 0.34;
  } else {
    filter.type = "lowpass";
    filter.frequency.value = kind === "ocean" ? 520 : 340;
    gain.gain.value = kind === "ocean" ? 0.46 : 0.13;
  }

  source.connect(filter).connect(gain).connect(master);

  if (kind === "ocean") {
    const lfo = context.createOscillator();
    const depth = context.createGain();
    lfo.frequency.value = 0.085;
    depth.gain.value = 0.22;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
    runtime.sources.push(lfo);
  }

  source.start();
  runtime.sources.push(source);
}

function addSoftPulse(runtime: AmbientRuntime) {
  const { context, master } = runtime;
  const tone = context.createOscillator();
  const toneGain = context.createGain();
  const pulse = context.createOscillator();
  const pulseDepth = context.createGain();

  tone.type = "sine";
  tone.frequency.value = 174.61;
  toneGain.gain.value = 0.12;
  pulse.type = "sine";
  pulse.frequency.value = 0.52;
  pulseDepth.gain.value = 0.075;

  tone.connect(toneGain).connect(master);
  pulse.connect(pulseDepth).connect(toneGain.gain);
  tone.start();
  pulse.start();
  runtime.sources.push(tone, pulse);
}

function scheduleChime(runtime: AmbientRuntime, frequency: number, delay = 0) {
  const { context, master } = runtime;
  const start = context.currentTime + delay;
  const tone = context.createOscillator();
  const overtone = context.createOscillator();
  const gain = context.createGain();
  const overtoneGain = context.createGain();

  tone.type = "sine";
  tone.frequency.value = frequency;
  overtone.type = "sine";
  overtone.frequency.value = frequency * 2.01;
  overtoneGain.gain.value = 0.18;

  tone.connect(gain);
  overtone.connect(overtoneGain).connect(gain);
  gain.connect(master);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.19, start + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 4.2);

  tone.start(start);
  overtone.start(start);
  tone.stop(start + 4.3);
  overtone.stop(start + 4.3);
  runtime.sources.push(tone, overtone);
}

function addChimeSequence(runtime: AmbientRuntime, spacious: boolean) {
  const notes = spacious
    ? [220, 261.63, 329.63, 293.66]
    : [261.63, 329.63, 392, 329.63];

  let noteIndex = 0;
  const playNext = () => {
    scheduleChime(runtime, notes[noteIndex % notes.length]);
    noteIndex += 1;
  };

  playNext();
  const timer = window.setInterval(playNext, spacious ? 6800 : 5200);
  runtime.timers.push(timer);
}

export function useAmbientSound() {
  const runtimeRef = useRef<AmbientRuntime | null>(null);

  const stop = useCallback((fadeMs = 420) => {
    const runtime = runtimeRef.current;
    runtimeRef.current = null;
    if (runtime) stopRuntime(runtime, fadeMs);
  }, []);

  const start = useCallback(async (kind: AmbientSoundKind) => {
    stop(120);

    const AudioContextConstructor =
      window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    const master = context.createGain();
    const runtime: AmbientRuntime = {
      context,
      master,
      sources: [],
      timers: [],
    };
    runtimeRef.current = runtime;

    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.8);
    master.connect(context.destination);

    if (kind === "rain") addNoiseBed(runtime, "rain");
    if (kind === "ocean") addNoiseBed(runtime, "ocean");
    if (kind === "meditation") {
      addNoiseBed(runtime, "meditation");
      addChimeSequence(runtime, true);
    }
    if (kind === "piano") addChimeSequence(runtime, false);
    if (kind === "movement") addSoftPulse(runtime);

    await context.resume();
  }, [stop]);

  const setLevel = useCallback((level: number) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const target = Math.max(0.0001, Math.min(1, level) * 0.08);
    const now = runtime.context.currentTime;
    runtime.master.gain.cancelScheduledValues(now);
    runtime.master.gain.setTargetAtTime(target, now, 0.35);
  }, []);

  useEffect(() => () => stop(80), [stop]);

  return { start, stop, setLevel };
}
