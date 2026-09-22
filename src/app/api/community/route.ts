import { apiError, ok } from "@/server/errors";
import { listCommunityItems } from "@/server/repositories";

export const runtime = "nodejs";
const COMMUNITY_PAGE_SIZE = 30;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    const page = listCommunityItems(COMMUNITY_PAGE_SIZE + 1, offset);
    const items = page.slice(0, COMMUNITY_PAGE_SIZE);
    return ok({ items, nextOffset: page.length > COMMUNITY_PAGE_SIZE ? offset + COMMUNITY_PAGE_SIZE : null });
  } catch (error) {
    return apiError(error);
  }
}
