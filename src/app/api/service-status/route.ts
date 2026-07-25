export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(
    {
      conversation: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
      sound: Boolean(process.env.MINIMAX_API_KEY?.trim()),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
