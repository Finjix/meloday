import { apiError, ok, requireJsonObject } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { messageSchema, parseOrThrow } from "@/lib/schemas";
import { receiveMessage } from "@/server/session-service";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const input = parseOrThrow(messageSchema, requireJsonObject(await request.json()));
    return ok(await receiveMessage(id, user.id, user.agentName, input.content));
  } catch (error) {
    return apiError(error);
  }
}
