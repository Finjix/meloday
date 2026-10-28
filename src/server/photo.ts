import { HttpError } from "./errors";
import { writeMedia } from "./media";

const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function uploadPhoto(request: Request, userId: string): Promise<string> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isSafeInteger(length) || length < 0 || length > 11 * 1024 * 1024) throw new HttpError(413, "PHOTO_TOO_LARGE", "照片不能超过 10 MB。");
  const form = await readUploadForm(request, 11 * 1024 * 1024);
  const file = form.get("photo");
  if (!(file instanceof File)) throw new HttpError(400, "INVALID_PHOTO", "请选择一张照片。");
  const mimeType = file.type.toLowerCase();
  const extension = extensions[mimeType];
  if (!extension) throw new HttpError(400, "INVALID_PHOTO", "请选择 JPG、PNG 或 WebP 照片。");
  if (!file.size || file.size > 10 * 1024 * 1024) throw new HttpError(413, "PHOTO_TOO_LARGE", "照片不能超过 10 MB。");
  return writeMedia("cover", userId, Buffer.from(await file.arrayBuffer()), mimeType, extension);
}

export async function readUploadForm(request: Request, maxBytes: number): Promise<FormData> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "INVALID_UPLOAD", "请选择要上传的图片。");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new HttpError(413, "UPLOAD_TOO_LARGE", "上传的图片过大。");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks, total), { headers: { "content-type": request.headers.get("content-type") ?? "" } })
    .formData().catch(() => { throw new HttpError(400, "INVALID_UPLOAD", "图片上传格式不正确。"); });
}
