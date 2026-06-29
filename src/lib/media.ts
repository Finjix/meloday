import type { CoverMeta } from "@/lib/types";

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export function createMockAudioBlob(seed: string) {
  const sampleRate = 44100;
  const duration = 13;
  const totalSamples = sampleRate * duration;
  const samples = new Float32Array(totalSamples);
  const hash = hashString(seed);
  const roots = [196, 220, 246.94, 261.63, 293.66];
  const root = roots[hash % roots.length];
  const chord = [root, root * 1.25, root * 1.5, root * 2];
  const drift = 0.18 + ((hash >>> 3) % 18) / 100;

  for (let index = 0; index < totalSamples; index += 1) {
    const t = index / sampleRate;
    const attack = Math.min(1, t / 1.1);
    const release = Math.min(1, (duration - t) / 2.5);
    const envelope = Math.max(0, Math.min(attack, release));
    const pulse = 0.55 + 0.45 * Math.sin(2 * Math.PI * (0.08 + drift / 8) * t);
    const pad = chord.reduce((sum, frequency, chordIndex) => {
      const detune = 1 + Math.sin(t * 0.21 + chordIndex) * 0.002;
      return sum + Math.sin(2 * Math.PI * frequency * detune * t) * (0.08 / (chordIndex + 1));
    }, 0);
    const melodyFrequency = chord[Math.floor((t / 1.8 + (hash % 4)) % chord.length)] * 2;
    const melody =
      Math.sin(2 * Math.PI * melodyFrequency * t) *
      Math.max(0, Math.sin(2 * Math.PI * 0.22 * t)) *
      0.035;
    const texture = Math.sin(2 * Math.PI * (root / 4) * t + Math.sin(t * 0.6)) * 0.025;
    samples[index] = (pad * pulse + melody + texture) * envelope * 0.62;
  }

  return encodeWav(samples, sampleRate);
}

export function createMockCoverBlob(meta: CoverMeta, title: string, seed: string) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 1200;
    const context = canvas.getContext("2d");

    if (!context) {
      reject(new Error("Canvas is not available."));
      return;
    }

    const hash = hashString(seed);
    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, meta.palette.from);
    gradient.addColorStop(0.52, meta.palette.via);
    gradient.addColorStop(1, meta.palette.to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.globalAlpha = 0.28;
    for (let index = 0; index < 22; index += 1) {
      const radius = 120 + ((hash >>> (index % 12)) % 220);
      const x = ((hash * (index + 11)) % canvas.width) - radius / 2;
      const y = ((hash * (index + 29)) % canvas.height) - radius / 2;
      context.beginPath();
      context.fillStyle = index % 2 === 0 ? "#ffffff" : meta.palette.accent;
      context.ellipse(x, y, radius, radius * 0.42, index * 0.35, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 0.18;
    context.strokeStyle = meta.palette.accent;
    context.lineWidth = 2;
    for (let index = 0; index < 9; index += 1) {
      const y = 250 + index * 84 + ((hash >>> index) % 18);
      context.beginPath();
      for (let x = -20; x <= canvas.width + 20; x += 18) {
        const wave = Math.sin(x / 70 + index * 0.9) * (18 + index * 2);
        if (x === -20) context.moveTo(x, y + wave);
        else context.lineTo(x, y + wave);
      }
      context.stroke();
    }

    context.globalAlpha = 0.82;
    context.fillStyle = "#23302f";
    context.font = '600 68px "Arial", sans-serif';
    context.textAlign = "center";
    context.fillText(title, canvas.width / 2, canvas.height - 190, canvas.width - 140);
    context.globalAlpha = 0.55;
    context.font = '28px "Arial", sans-serif';
    context.fillText("Meloday", canvas.width / 2, canvas.height - 135);

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to render cover."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
