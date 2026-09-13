import { getDb } from "@/server/db";
import { config } from "@/server/config";

export const runtime = "nodejs";

export function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return Response.json({ status: "ok", providerMode: config.providerMode, time: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
