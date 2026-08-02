export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      available: Boolean(process.env.MINIMAX_API_KEY?.trim()),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
