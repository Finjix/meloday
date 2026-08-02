import { ServiceConfigError } from "@/lib/server/deepseek";

export function apiErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof ServiceConfigError ? error.status : 502;
  return Response.json({ error: message }, { status });
}
