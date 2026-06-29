import type { ChatMessage } from "@/lib/types";
import { getMockAgentTurn } from "@/lib/mock-agent";
import { isRealAiModeEnabled } from "@/lib/server/deepseek";

export const runtime = "edge";

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
  const body = (await request.json()) as { messages?: ChatMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (isRealAiModeEnabled()) {
    // Real AI mode is intentionally not wired until the mock loop is accepted.
    // The adapter boundary exists so this route can later swap in AI SDK streaming.
  }

  const result = getMockAgentTurn(messages);
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
}
