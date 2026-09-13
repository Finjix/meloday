import { getRequestUser } from "@/server/auth";
import { apiError } from "@/server/errors";
import { readMediaForUser } from "@/server/media";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const media = await readMediaForUser(id, getRequestUser(request)?.id ?? null);
    return new Response(new Uint8Array(media.buffer), { status: 200, headers: { "Content-Type": media.mimeType, "Content-Length": String(media.byteSize), "Cache-Control": "private, max-age=3600" } });
  } catch (error) {
    return apiError(error);
  }
}
