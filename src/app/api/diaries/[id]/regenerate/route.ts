import { apiError, HttpError, ok, requireJsonObject } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { beginDiaryRegeneration } from "@/server/diary-regeneration";
import { getLatestDiaryRegeneration } from "@/server/repositories";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    return ok(getLatestDiaryRegeneration(id, user.id));
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const body = requireJsonObject(await request.json());
    if (body.kind !== "music" && body.kind !== "cover") throw new HttpError(400, "INVALID_KIND", "请选择重新生成音乐或封面。");
    if (body.feedback !== undefined && typeof body.feedback !== "string") throw new HttpError(400, "INVALID_FEEDBACK", "补充要求格式不正确。");
    return ok(beginDiaryRegeneration(id, user.id, body.kind, (body.feedback ?? "") as string));
  } catch (error) { return apiError(error); }
}
