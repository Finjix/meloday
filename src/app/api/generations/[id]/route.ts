import { apiError, ok } from "@/server/errors";
import { requireRequestUser } from "@/server/auth";
import { getGeneration } from "@/server/generation";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    return ok(getGeneration(id, user.id));
  } catch (error) {
    return apiError(error);
  }
}
