import { apiError, ok } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { publishDiaryEntry } from "@/server/repositories";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const { id } = await context.params;
    const entry = publishDiaryEntry(id, user.id);
    return entry ? ok(entry) : ok(null);
  } catch (error) {
    return apiError(error);
  }
}
