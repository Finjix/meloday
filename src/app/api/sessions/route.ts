import { apiError, ok, requireJsonObject } from "@/server/errors";
import { requireRequestUser, assertSameOrigin } from "@/server/auth";
import { getLatestActiveSession } from "@/server/repositories";
import { getSessionSnapshot, newSeededSession, newSession } from "@/server/session-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = requireRequestUser(request);
    const session = getLatestActiveSession(user.id);
    return ok(session ? getSessionSnapshot(session.id, user.id) : null);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const body = requireJsonObject(await request.json().catch(() => ({})));
    return ok(typeof body.seed === "string" ? newSeededSession(user.id, body.seed) : newSession(user.id));
  } catch (error) {
    return apiError(error);
  }
}
