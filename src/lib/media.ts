import type { CoverMeta } from "@/lib/types";

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function createCoverBlob(meta: CoverMeta, title: string, seed: string) {
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
