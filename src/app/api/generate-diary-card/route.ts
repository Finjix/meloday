import type { ApiKeys, ChatMessage, CompanionPreferences, MomentContext } from "@/lib/types";
import {
  assembleCardPayload,
  generateCardContent,
} from "@/lib/server/deepseek";
import { apiErrorResponse } from "@/lib/server/http";
import { assertMiniMaxApiKey, generateInstrumentalMusic } from "@/lib/server/minimax";

export const runtime = "nodejs";

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
    return apiErrorResponse(error, "Card generation failed.");
  }
}
