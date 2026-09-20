import { parseOrThrow, loginSchema } from "@/lib/schemas";
import { apiError, ok, requireJsonObject, HttpError } from "@/server/errors";
import { assertSameOrigin, createSessionCookie, requestClientKey, setSessionCookie, validatePassword, validateUsername, verifyPassword } from "@/server/auth";
import { enforceRateLimit } from "@/server/rate-limit";
import { getCapacity, getUserByUsername } from "@/server/repositories";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    enforceRateLimit("login", requestClientKey(request), { limit: 12, windowMs: 15 * 60 * 1000 });
    const input = parseOrThrow(loginSchema, requireJsonObject(await request.json()));
    const user = getUserByUsername(validateUsername(input.username));
    const valid = user ? await verifyPassword(validatePassword(input.password), user.passwordHash) : false;
    if (!user || !valid) throw new HttpError(401, "INVALID_CREDENTIALS", "用户名或密码不正确。");
    const response = ok({ user, capacity: getCapacity(user.id) });
    setSessionCookie(response, createSessionCookie(user.id));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
