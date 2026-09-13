import { apiError, ok } from "@/server/errors";
import { listCommunityItems } from "@/server/repositories";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    return ok({ items: listCommunityItems(30, offset), nextOffset: offset + 30 });
  } catch (error) {
    return apiError(error);
  }
}
