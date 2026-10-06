import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { restoreDiaryRevision } from "@/server/repositories";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; revisionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id, revisionId } = await context.params;
    return ok(restoreDiaryRevision(id, user.id, revisionId));
  } catch (error) { return apiError(error); }
}
