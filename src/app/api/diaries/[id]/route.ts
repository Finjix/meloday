import { apiError, HttpError, ok, requireJsonObject } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { deleteDiaryEntry, editDiaryEntry, getDiaryEntry } from "@/server/repositories";
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const body = requireJsonObject(await request.json());
    const title = body.title;
    const summary = body.summary;
    const text = body.body;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 100 ||
        typeof summary !== "string" || summary.trim().length > 300 ||
        typeof text !== "string" || !text.trim() || text.trim().length > 10000) {
      throw new HttpError(400, "INVALID_DIARY", "标题、摘要或正文不符合长度要求。");
    }
    return ok(editDiaryEntry(id, user.id, { title: title.trim(), summary: summary.trim(), body: text.trim() }));
  } catch (error) { return apiError(error); }
}
