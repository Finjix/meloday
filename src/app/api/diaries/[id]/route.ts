import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { deleteDiaryEntry, getDiaryEntry } from "@/server/repositories";
import { removeOrphanedMedia } from "@/server/media";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const entry = getDiaryEntry(id, user.id);
    return entry ? ok(entry) : ok(null);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const deleted = deleteDiaryEntry(id, user.id);
    if (!deleted) return ok(null);
    await removeOrphanedMedia();
    return ok({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
