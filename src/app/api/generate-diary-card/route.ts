import type { ChatMessage } from "@/lib/types";
import { createMockCard } from "@/lib/mock-card";
import { isRealAiModeEnabled } from "@/lib/server/deepseek";

export const runtime = "edge";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const body = (await request.json()) as { messages?: ChatMessage[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (isRealAiModeEnabled()) {
    // Future real mode: DeepSeek writes diary/prompt and requests web-search cover data.
  }

  await sleep(520);
  return Response.json(createMockCard(messages), {
    headers: { "Cache-Control": "no-store" },
  });
}
