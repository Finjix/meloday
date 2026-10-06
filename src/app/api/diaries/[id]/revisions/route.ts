import { apiError, ok } from "@/server/errors";
import { requireRequestUser } from "@/server/auth";
import { getDiaryRevisions } from "@/server/repositories";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    return ok(getDiaryRevisions(id, user.id));
  } catch (error) { return apiError(error); }
}
