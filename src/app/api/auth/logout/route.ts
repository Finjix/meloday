import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, clearSessionCookie, clearSessionCookieOnResponse } from "@/server/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    clearSessionCookie(request);
    const response = ok({ ok: true });
    clearSessionCookieOnResponse(response);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
