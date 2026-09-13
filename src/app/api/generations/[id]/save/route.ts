import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { saveGeneration } from "@/server/generation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    return ok(saveGeneration(id, user.id));
  } catch (error) {
    return apiError(error);
  }
}
