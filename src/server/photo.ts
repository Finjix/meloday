import { HttpError } from "./errors";
import { writeMedia } from "./media";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function uploadPhoto(request: Request, userId: string): Promise<string> {
  const form = await request.formData().catch(() => { throw new HttpError(400, "INVALID_PHOTO", "照片上传格式不正确。"); });
  const file = form.get("photo");
  if (!(file instanceof File)) throw new HttpError(400, "INVALID_PHOTO", "请选择一张照片。");
  const mimeType = file.type.toLowerCase();
  const extension = extensions[mimeType];
  if (!extension) throw new HttpError(400, "INVALID_PHOTO", "请选择 JPG、PNG 或 WebP 照片。");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new HttpError(413, "PHOTO_TOO_LARGE", "照片不能超过 10 MB。");
  return writeMedia("cover", userId, Buffer.from(await file.arrayBuffer()), mimeType, extension);
}
