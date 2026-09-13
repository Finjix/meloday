import { apiError, ok, requireJsonObject } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { beginGeneration } from "@/server/generation";
import { getLatestGenerationForSession } from "@/server/repositories";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    return ok(getLatestGenerationForSession(id, user.id));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const body = requireJsonObject(await request.json().catch(() => ({})));
    const feedback = typeof body.feedback === "string" ? body.feedback.trim().slice(0, 1000) : null;
    return ok(beginGeneration(id, user.id, feedback));
  } catch (error) {
    return apiError(error);
  }
}
