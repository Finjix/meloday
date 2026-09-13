import { apiError, ok, requireJsonObject } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { parseOrThrow, regenerateSchema } from "@/lib/schemas";
import { beginRegeneration } from "@/server/generation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const input = parseOrThrow(regenerateSchema, requireJsonObject(await request.json().catch(() => ({}))));
    return ok(beginRegeneration(id, user.id, input.feedback));
  } catch (error) {
    return apiError(error);
  }
}
