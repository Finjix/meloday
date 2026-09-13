import { apiError, ok } from "@/server/errors";
import { requireRequestUser } from "@/server/auth";
import { getCapacity, getDiaryEntries } from "@/server/repositories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = requireRequestUser(request);
    return ok({ entries: getDiaryEntries(user.id), capacity: getCapacity(user.id) });
  } catch (error) {
    return apiError(error);
  }
}
