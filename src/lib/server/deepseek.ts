import { deepseek } from "@ai-sdk/deepseek";

export const deepseekModelId = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash";

export function isRealAiModeEnabled() {
  return process.env.MELODAY_AI_MODE === "real" && Boolean(process.env.DEEPSEEK_API_KEY);
}

export function getDeepSeekModel() {
  return deepseek(deepseekModelId);
}
