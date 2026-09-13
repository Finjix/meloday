import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { endSession, getSessionSnapshot } from "@/server/session-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const session = getSessionSnapshot(id, user.id);
    if (!session) return ok(null);
    return ok(session);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    endSession(id, user.id);
    return ok({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
