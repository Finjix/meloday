import { apiError, ok } from "@/server/errors";
import { requireRequestUser } from "@/server/auth";
import { readDiaryRegeneration } from "@/server/diary-regeneration";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    const user = requireRequestUser(request);
    const { id } = await context.params;
    return ok(readDiaryRegeneration(id, user.id));
  } catch (error) { return apiError(error); }
}
