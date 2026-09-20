import { getRequestUser } from "@/server/auth";
import { apiError } from "@/server/errors";
import { readMediaForUser } from "@/server/media";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const media = await readMediaForUser(id, getRequestUser(request)?.id ?? null);
    const totalLength = media.buffer.length;
    const headers = new Headers({ "Content-Type": media.mimeType, "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" });
    if (new URL(request.url).searchParams.get("download") === "1") {
      const extension = media.mimeType === "image/jpeg" ? "jpg" : media.mimeType === "image/png" ? "png" : media.mimeType === "image/svg+xml" ? "svg" : "img";
      headers.set("Content-Disposition", `attachment; filename="meloday-cover.${extension}"`);
    }
    const rangeHeader = request.headers.get("range");
    if (!rangeHeader) {
      headers.set("Content-Length", String(totalLength));
      return new Response(new Uint8Array(media.buffer), { status: 200, headers });
    }

    const rangeMatch = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!rangeMatch || totalLength === 0) return new Response(null, { status: 416, headers: new Headers({ "Content-Range": `bytes */${totalLength}` }) });
    const [, startText, endText] = rangeMatch;
    const suffixLength = endText && !startText ? Number(endText) : null;
    const start = startText ? Number(startText) : Math.max(totalLength - (suffixLength ?? 0), 0);
    const end = endText && startText ? Math.min(Number(endText), totalLength - 1) : totalLength - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= totalLength || end < start) {
      return new Response(null, { status: 416, headers: new Headers({ "Content-Range": `bytes */${totalLength}` }) });
    }
    const body = new Uint8Array(media.buffer.subarray(start, end + 1));
    headers.set("Content-Length", String(body.byteLength));
    headers.set("Content-Range", `bytes ${start}-${end}/${totalLength}`);
    return new Response(body, { status: 206, headers });
  } catch (error) {
    return apiError(error);
  }
}
