import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { apiError, HttpError, ok, requireJsonObject } from "@/server/errors";
import { beginGeneration } from "@/server/generation";
import { getSessionSnapshot, newQuickMusicSession, type QuickMusicPreset } from "@/server/session-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const body = requireJsonObject(await request.json());
    const preset = body.preset;
    if (preset !== "relax" && preset !== "move") throw new HttpError(400, "INVALID_MUSIC_PRESET", "请选择有效的音乐类型。");
    const session = newQuickMusicSession(user.id, preset as QuickMusicPreset);
    const job = beginGeneration(session.id, user.id);
    return ok({ session: getSessionSnapshot(session.id, user.id)!, job });
  } catch (error) {
    return apiError(error);
  }
}
