import type { CoverMeta } from "@/lib/types";

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seededRandom(seed: number) {
  let state = seed || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function withAlpha(color: string, alpha: number) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return color;
  return `rgba(${Number.parseInt(match[1], 16)}, ${Number.parseInt(match[2], 16)}, ${Number.parseInt(match[3], 16)}, ${alpha})`;
}

function drawGlow(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
) {
  const glow = context.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, withAlpha(color, .72));
  glow.addColorStop(.45, withAlpha(color, .28));
  glow.addColorStop(1, withAlpha(color, 0));
  context.fillStyle = glow;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function drawHorizon(
  context: CanvasRenderingContext2D,
  random: () => number,
  meta: CoverMeta,
) {
  drawGlow(context, 665, 325, 330, "#ffffff");

  for (let layer = 0; layer < 6; layer += 1) {
    const baseline = 350 + layer * 105;
    context.beginPath();
    context.moveTo(-80, baseline);
    context.bezierCurveTo(
      180,
      baseline - 120 - random() * 90,
      560,
      baseline + 95 + random() * 80,
      980,
      baseline - 35,
    );
    context.lineTo(980, 1220);
    context.lineTo(-80, 1220);
    context.closePath();
    context.fillStyle =
      layer % 2 === 0
        ? withAlpha(meta.palette.accent, .09 + layer * .018)
        : `rgba(255, 255, 255, ${.12 + layer * .018})`;
    context.fill();
  }
}

function drawRibbons(
  context: CanvasRenderingContext2D,
  random: () => number,
  meta: CoverMeta,
) {
  context.lineCap = "round";

  for (let index = 0; index < 7; index += 1) {
    const startY = 165 + index * 112 + random() * 46;
    context.beginPath();
    context.moveTo(-130, startY);
    context.bezierCurveTo(
      170 + random() * 150,
      startY - 210,
      520 + random() * 180,
      startY + 220,
      1030,
      startY - 35,
    );
    context.strokeStyle =
      index % 2 === 0
        ? withAlpha(meta.palette.accent, .13 + index * .018)
        : `rgba(255, 255, 255, ${.18 + index * .022})`;
    context.lineWidth = 34 + random() * 72;
    context.stroke();
  }

  drawGlow(context, 215, 300, 260, meta.palette.via);
}

function drawOrbits(
  context: CanvasRenderingContext2D,
  random: () => number,
  meta: CoverMeta,
) {
  const centerX = 565 + random() * 90;
  const centerY = 415 + random() * 80;
  drawGlow(context, centerX, centerY, 285, "#ffffff");

  context.save();
  context.translate(centerX, centerY);
  context.rotate(-.24 + random() * .18);

  for (let index = 0; index < 8; index += 1) {
    context.beginPath();
    context.ellipse(
      0,
      0,
      110 + index * 54,
      70 + index * 31,
      0,
      index * .32,
      Math.PI * (1.08 + random() * .72),
    );
    context.strokeStyle =
      index % 3 === 0
        ? withAlpha(meta.palette.accent, .22)
        : "rgba(255, 255, 255, .24)";
    context.lineWidth = index % 3 === 0 ? 5 : 2;
    context.stroke();
  }

  context.fillStyle = withAlpha(meta.palette.accent, .52);
  context.beginPath();
  context.arc(210, -25, 13, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBloom(
  context: CanvasRenderingContext2D,
  random: () => number,
  meta: CoverMeta,
) {
  const centerX = 590 + random() * 80;
  const centerY = 415 + random() * 80;
  drawGlow(context, centerX, centerY, 310, "#ffffff");

  context.save();
  context.translate(centerX, centerY);
  for (let index = 0; index < 15; index += 1) {
    context.save();
    context.rotate((Math.PI * 2 * index) / 15 + random() * .12);
    context.beginPath();
    context.ellipse(0, -155, 72 + random() * 45, 190 + random() * 75, 0, 0, Math.PI * 2);
    context.fillStyle =
      index % 2 === 0
        ? withAlpha(meta.palette.accent, .09)
        : "rgba(255, 255, 255, .16)";
    context.fill();
    context.restore();
  }
  context.restore();
}

function wrapTitle(
  context: CanvasRenderingContext2D,
  title: string,
  maxWidth: number,
  maxLines = 2,
) {
  const characters = Array.from(title.trim() || "今天的声音");
  const lines: string[] = [];
  let line = "";

  for (const character of characters) {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
      if (lines.length === maxLines - 1) break;
    } else {
      line = candidate;
    }
  }

  const consumed = lines.join("").length + line.length;
  const hasOverflow = consumed < characters.length;
  if (line) lines.push(line + (hasOverflow ? "…" : ""));
  return lines.slice(0, maxLines);
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
    const random = seededRandom(hash);
    const gradient = context.createLinearGradient(50, 0, 850, 1200);
    gradient.addColorStop(0, meta.palette.from);
    gradient.addColorStop(.48, meta.palette.via);
    gradient.addColorStop(1, meta.palette.to);
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.globalCompositeOperation = "screen";
    const composition = hash % 4;
    if (composition === 0) drawHorizon(context, random, meta);
    if (composition === 1) drawRibbons(context, random, meta);
    if (composition === 2) drawOrbits(context, random, meta);
    if (composition === 3) drawBloom(context, random, meta);
    context.restore();

    context.save();
    context.globalAlpha = .055;
    for (let index = 0; index < 1800; index += 1) {
      const size = random() > .86 ? 2 : 1;
      context.fillStyle = random() > .5 ? "#ffffff" : "#20352e";
      context.fillRect(random() * canvas.width, random() * canvas.height, size, size);
    }
    context.restore();

    const vignette = context.createLinearGradient(0, 430, 0, 1200);
    vignette.addColorStop(0, "rgba(21, 38, 33, 0)");
    vignette.addColorStop(.62, "rgba(21, 38, 33, .12)");
    vignette.addColorStop(1, "rgba(21, 38, 33, .72)");
    context.fillStyle = vignette;
    context.fillRect(0, 350, 900, 850);

    context.fillStyle = "rgba(255, 255, 255, .88)";
    context.font = '600 28px "Arial", sans-serif';
    context.textAlign = "left";
    context.fillText("Meloday", 72, 88);

    context.fillStyle = withAlpha(meta.palette.accent, .78);
    context.fillRect(72, 112, 64, 5);

    const titleSize = Array.from(title.trim()).length > 12 ? 58 : 68;
    context.font = `600 ${titleSize}px "Noto Serif SC", "Songti SC", serif`;
    context.fillStyle = "#ffffff";
    context.shadowColor = "rgba(18, 34, 29, .22)";
    context.shadowBlur = 18;
    const titleLines = wrapTitle(context, title, 740);
    const firstBaseline = 990 - (titleLines.length - 1) * 72;
    titleLines.forEach((line, index) => {
      context.fillText(line, 72, firstBaseline + index * 78);
    });
    context.shadowBlur = 0;

    context.fillStyle = "rgba(255, 255, 255, .68)";
    context.font = '400 24px "Arial", sans-serif';
    context.fillText("一段只属于此刻的声音", 72, 1100);

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to render cover."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}
