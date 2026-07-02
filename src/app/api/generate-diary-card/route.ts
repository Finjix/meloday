import type { ApiKeys, ChatMessage } from "@/lib/types";
import {
  assembleCardPayload,
  generateCardContent,
  ServiceConfigError,
} from "@/lib/server/deepseek";
import { agentDebugError, agentDebugLog } from "@/lib/server/debug-log";
import { assertMiniMaxApiKey, generateInstrumentalMusic } from "@/lib/server/minimax";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Card generation failed.";
  const status = error instanceof ServiceConfigError ? error.status : 502;
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: ChatMessage[]; apiKeys?: ApiKeys };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    agentDebugLog("generate-diary-card request", {
      messages,
      hasDeepSeekApiKey: Boolean(body.apiKeys?.deepseekApiKey),
      hasMiniMaxApiKey: Boolean(body.apiKeys?.minimaxApiKey),
    });
    assertMiniMaxApiKey(body.apiKeys);
    const content = await generateCardContent(messages, body.apiKeys);
    const audio = await generateInstrumentalMusic(content.musicPrompt, body.apiKeys);
    agentDebugLog("generate-diary-card response", {
      content,
      audio: { mimeType: audio.mimeType, hexLength: audio.hex.length },
    });

    return Response.json(assembleCardPayload(content, audio), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    agentDebugError("generate-diary-card error", error);
    return errorResponse(error);
  }
}
