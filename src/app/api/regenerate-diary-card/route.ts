import type { ApiKeys, CardPayload } from "@/lib/types";
import {
  assembleCardPayload,
  regenerateCardContent,
  ServiceConfigError,
} from "@/lib/server/deepseek";
import { agentDebugError, agentDebugLog } from "@/lib/server/debug-log";
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
    };

    if (!body.card || !body.feedback?.trim()) {
      return Response.json({ error: "Missing card or feedback." }, { status: 400 });
    }

    agentDebugLog("regenerate-diary-card request", {
      card: body.card,
      feedback: body.feedback,
      hasDeepSeekApiKey: Boolean(body.apiKeys?.deepseekApiKey),
      hasMiniMaxApiKey: Boolean(body.apiKeys?.minimaxApiKey),
    });
    assertMiniMaxApiKey(body.apiKeys);
    const content = await regenerateCardContent(body.card, body.feedback, body.apiKeys);
    const audio = await generateInstrumentalMusic(content.musicPrompt, body.apiKeys);
    agentDebugLog("regenerate-diary-card response", {
      content,
      audio: { mimeType: audio.mimeType, hexLength: audio.hex.length },
    });

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
    agentDebugError("regenerate-diary-card error", error);
    return errorResponse(error);
  }
}
