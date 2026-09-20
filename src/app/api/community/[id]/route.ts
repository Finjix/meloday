import { apiError, ok } from "@/server/errors";
import { getSharedDiaryEntry } from "@/server/repositories";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    return ok(getSharedDiaryEntry(id));
  } catch (error) {
    return apiError(error);
  }
}
