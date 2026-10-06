import { apiError, HttpError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { getSessionSnapshot } from "@/server/session-service";
import { setSessionPhoto } from "@/server/repositories";
import { uploadPhoto } from "@/server/photo";
import { removeOrphanedMedia } from "@/server/media";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const session = getSessionSnapshot(id, user.id);
    if (!session || session.status !== "active") throw new HttpError(409, "SESSION_NOT_ACTIVE", "只能给正在写的日记添加照片。");
    const assetId = await uploadPhoto(request, user.id);
    if (!setSessionPhoto(id, user.id, assetId)) {
      await removeOrphanedMedia();
      throw new HttpError(409, "SESSION_NOT_ACTIVE", "这段日记已结束，请重新上传照片。");
    }
    await removeOrphanedMedia();
    return ok(getSessionSnapshot(id, user.id));
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    if (!setSessionPhoto(id, user.id, null)) throw new HttpError(409, "SESSION_NOT_ACTIVE", "这段日记已结束。");
    await removeOrphanedMedia();
    return ok(getSessionSnapshot(id, user.id));
  } catch (error) { return apiError(error); }
}
