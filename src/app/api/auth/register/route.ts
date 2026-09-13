import { NextResponse } from "next/server";
import { parseOrThrow, registerSchema } from "@/lib/schemas";
import { apiError, ok, requireJsonObject } from "@/server/errors";
import { assertSameOrigin, createSessionCookie, hashPassword, setSessionCookie, validatePassword, validateUsername } from "@/server/auth";
import { createUser, getUserByUsername } from "@/server/repositories";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = parseOrThrow(registerSchema, requireJsonObject(await request.json()));
    const username = validateUsername(input.username);
    const password = validatePassword(input.password);
    if (getUserByUsername(username)) return NextResponse.json({ error: { code: "USERNAME_TAKEN", message: "这个用户名已经被使用了。" } }, { status: 409 });
    const user = createUser({ username, displayName: username, passwordHash: await hashPassword(password) });
    const response = ok({ user, capacity: { used: 0, limit: user.diaryLimit } });
    setSessionCookie(response, createSessionCookie(user.id));
    return response;
  } catch (error) {
    return apiError(error);
  }
}
