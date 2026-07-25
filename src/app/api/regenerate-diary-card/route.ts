import type { ApiKeys, CardPayload, CompanionPreferences, MomentContext } from "@/lib/types";
import {
  assembleCardPayload,
  regenerateCardContent,
  ServiceConfigError,
} from "@/lib/server/deepseek";

import { assertMiniMaxApiKey, generateInstrumentalMusic } from "@/lib/server/minimax";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Regeneration failed.";
  const status = error instanceof ServiceConfigError ? error.status : 502;
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      card?: CardPayload;
      feedback?: string;
      apiKeys?: ApiKeys;
      preferences?: CompanionPreferences;
      momentContext?: MomentContext;
      memories?: string[];
    };

    if (!body.card || !body.feedback?.trim()) {
      return Response.json({ error: "Missing card or feedback." }, { status: 400 });
    }

    assertMiniMaxApiKey(body.apiKeys);
    const content = await regenerateCardContent(
      body.card,
      body.feedback,
      body.apiKeys,
      body.preferences,
      body.momentContext,
      body.memories,
    );
    const audio = await generateInstrumentalMusic(content.musicPrompt, body.apiKeys);
    return Response.json(
      assembleCardPayload(content, audio, {
        createdAt: body.card.createdAt,
        date: body.card.date,
      }),
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
