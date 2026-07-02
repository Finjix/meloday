import type { ApiKeys, ChatMessage } from "@/lib/types";
import { generateAgentTurn, ServiceConfigError } from "@/lib/server/deepseek";
import { agentDebugError, agentDebugLog } from "@/lib/server/debug-log";

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

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Agent response failed.";
  const status = error instanceof ServiceConfigError ? error.status : 502;
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { messages?: ChatMessage[]; apiKeys?: ApiKeys };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    agentDebugLog("agent-turn request", {
      messages,
      hasDeepSeekApiKey: Boolean(body.apiKeys?.deepseekApiKey),
    });
    const result = await generateAgentTurn(messages, body.apiKeys);
    agentDebugLog("agent-turn response", result);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({
              type: "meta",
              action: result.action,
              collected: result.collected,
            })}\n`,
          ),
        );

        for (const chunk of chunkText(result.message)) {
          controller.enqueue(
            encoder.encode(`${JSON.stringify({ type: "delta", text: chunk })}\n`),
          );
          await sleep(26);
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
    agentDebugError("agent-turn error", error);
    return errorResponse(error);
  }
}
