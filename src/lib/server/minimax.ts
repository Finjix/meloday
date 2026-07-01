import type { ApiKeys } from "@/lib/types";
import { ServiceConfigError } from "@/lib/server/deepseek";

export const minimaxApiHost = (
  process.env.MINIMAX_API_HOST ?? "https://api.minimaxi.com"
).replace(/\/+$/, "");
const minimaxMusicEndpoint = `${minimaxApiHost}/v1/music_generation`;
export const minimaxMusicModelId = process.env.MINIMAX_MUSIC_MODEL ?? "music-2.0";

type MiniMaxMusicResponse = {
  data?: {
    audio?: string;
    status?: number;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
  trace_id?: string;
};

function getMiniMaxApiKey(apiKeys?: ApiKeys) {
  const key = process.env.MINIMAX_API_KEY || apiKeys?.minimaxApiKey;
  if (!key?.trim()) {
    throw new ServiceConfigError("缺少 MiniMax API Key。请配置 MINIMAX_API_KEY，或在“我的”页填写。");
  }
  return key.trim();
}

export function assertMiniMaxApiKey(apiKeys?: ApiKeys) {
  getMiniMaxApiKey(apiKeys);
}

export async function generateInstrumentalMusic(prompt: string, apiKeys?: ApiKeys) {
  const response = await fetch(minimaxMusicEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getMiniMaxApiKey(apiKeys)}`,
    },
    body: JSON.stringify({
      model: minimaxMusicModelId,
      prompt: prompt.slice(0, 2000),
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: "mp3",
      },
      output_format: "hex",
      is_instrumental: true,
    }),
  });

  let payload: MiniMaxMusicResponse | undefined;
  try {
    payload = (await response.json()) as MiniMaxMusicResponse;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    throw new Error(`MiniMax 音乐生成失败（HTTP ${response.status}）。`);
  }

  const statusCode = payload?.base_resp?.status_code ?? 0;
  if (statusCode !== 0) {
    const message = payload?.base_resp?.status_msg || "未知错误";
    if (statusCode === 2049 || /invalid api key/i.test(message)) {
      throw new Error(
        `MiniMax 音乐生成失败：invalid api key。当前请求域名是 ${minimaxApiHost}。如果使用国内站 platform.minimaxi.com 创建的 key，应使用 https://api.minimaxi.com；如果使用国际站 platform.minimax.io 创建的 key，应将 MINIMAX_API_HOST 设为 https://api.minimax.io。`,
      );
    }
    throw new Error(`MiniMax 音乐生成失败：${message}`);
  }

  const audioHex = payload?.data?.audio;
  if (!audioHex) {
    throw new Error("MiniMax 音乐生成失败：响应中没有音频数据。");
  }

  return {
    hex: audioHex,
    mimeType: "audio/mpeg",
  };
}
