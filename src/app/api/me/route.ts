import { apiError, ok } from "@/server/errors";
import { getRequestUser } from "@/server/auth";
import { getCapacity } from "@/server/repositories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = getRequestUser(request);
    return ok(user ? { user, capacity: getCapacity(user.id) } : null);
  } catch (error) {
    return apiError(error);
  }
}
