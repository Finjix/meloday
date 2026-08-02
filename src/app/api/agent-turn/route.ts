import type { ApiKeys, ChatMessage, CompanionPreferences, MomentContext } from "@/lib/types";
import { generateAgentTurn } from "@/lib/server/minimax-text";
import { apiErrorResponse } from "@/lib/server/http";

export const runtime = "nodejs";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkText(text: string) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += 4) {
    chunks.push(text.slice(index, index + 4));
  }
  return chunks;
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
    const result = await generateAgentTurn(
      messages,
      body.apiKeys,
      body.preferences,
      body.momentContext,
      body.memories,
    );
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              type: "meta",
              action: result.action,
              collected: result.collected,
              readyToGenerate: result.readyToGenerate,
              replyCount: result.replyCount,
            })}\n`,
          ),
        );

        const text = result.segments.join("").trim();
        for (const chunk of chunkText(text)) {
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ type: "delta", text: chunk })}\n`),
          );
          await sleep(8);
        }

        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done" })}\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Agent response failed.");
  }
}
