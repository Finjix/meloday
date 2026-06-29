import type { CardPayload } from "@/lib/types";
import { regenerateMockCard } from "@/lib/mock-card";
import { isRealAiModeEnabled } from "@/lib/server/deepseek";

export const runtime = "edge";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    card?: CardPayload;
    feedback?: string;
  };

  if (!body.card || !body.feedback?.trim()) {
    return Response.json({ error: "Missing card or feedback." }, { status: 400 });
  }

  if (isRealAiModeEnabled()) {
    // Future real mode: classify requested changes, then regenerate only affected parts.
  }

  await sleep(520);
  return Response.json(regenerateMockCard(body.card, body.feedback), {
    headers: { "Cache-Control": "no-store" },
  });
}
