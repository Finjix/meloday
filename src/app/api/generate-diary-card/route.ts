import type { ApiKeys, ChatMessage, CompanionPreferences, MomentContext } from "@/lib/types";
import {
  assembleCardPayload,
  generateCardContent,
  ServiceConfigError,
} from "@/lib/server/deepseek";

import { assertMiniMaxApiKey, generateInstrumentalMusic } from "@/lib/server/minimax";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Card generation failed.";
  const status = error instanceof ServiceConfigError ? error.status : 502;
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: ChatMessage[];
      apiKeys?: ApiKeys;
      preferences?: CompanionPreferences;
      momentContext?: MomentContext;
      memories?: string[];
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    assertMiniMaxApiKey(body.apiKeys);
    const content = await generateCardContent(
      messages,
      body.apiKeys,
      body.preferences,
      body.momentContext,
      body.memories,
    );
    const audio = await generateInstrumentalMusic(content.musicPrompt, body.apiKeys);
    return Response.json(assembleCardPayload(content, audio), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
