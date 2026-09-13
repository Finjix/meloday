import { apiError, ok, requireJsonObject } from "@/server/errors";
import { assertSameOrigin, requireRequestUser } from "@/server/auth";
import { parseOrThrow, profileSchema } from "@/lib/schemas";
import { getCapacity, updateUserProfile } from "@/server/repositories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = requireRequestUser(request);
    return ok({ user, capacity: getCapacity(user.id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = requireRequestUser(request);
    const input = parseOrThrow(profileSchema, requireJsonObject(await request.json()));
    return ok(updateUserProfile(user.id, input));
  } catch (error) {
    return apiError(error);
  }
}
