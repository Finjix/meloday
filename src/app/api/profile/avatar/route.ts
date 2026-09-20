import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { updateUserProfile } from "@/server/repositories";
import { removeOrphanedMedia, writeMedia } from "@/server/media";
import { HttpError } from "@/server/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 4 * 1024 * 1024) throw new HttpError(413, "AVATAR_TOO_LARGE", "头像不能超过 3MB。");
    const form = await request.formData();
    const file = form.get("avatar");
    if (!(file instanceof File)) throw new HttpError(400, "AVATAR_REQUIRED", "请选择一张头像图片。");
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new HttpError(400, "AVATAR_FORMAT", "头像仅支持 PNG、JPG 或 WebP。");
    if (file.size > 3 * 1024 * 1024) throw new HttpError(413, "AVATAR_TOO_LARGE", "头像不能超过 3MB。");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const assetId = await writeMedia("avatar", user.id, Buffer.from(await file.arrayBuffer()), file.type, extension);
    const updated = updateUserProfile(user.id, { avatarAssetId: assetId });
    await removeOrphanedMedia();
    return ok(updated);
  } catch (error) {
    return apiError(error);
  }
}
