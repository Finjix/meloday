import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { setDiaryPhoto } from "@/server/repositories";
import { uploadPhoto } from "@/server/photo";
import { removeOrphanedMedia } from "@/server/media";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const assetId = await uploadPhoto(request, user.id);
    const entry = setDiaryPhoto(id, user.id, assetId);
    await removeOrphanedMedia();
    return ok(entry);
  } catch (error) { await removeOrphanedMedia(); return apiError(error); }
}

export async function DELETE(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const entry = setDiaryPhoto(id, user.id, null);
    await removeOrphanedMedia();
    return ok(entry);
  } catch (error) { return apiError(error); }
}
