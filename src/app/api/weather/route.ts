export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function weatherSummary(code: number, isDay: boolean) {
  if (code === 0) return isDay ? "晴朗" : "晴夜";
  if (code === 1) return "大致晴朗";
  if (code === 2) return "多云";
  if (code === 3) return "阴天";
  if (code === 45 || code === 48) return "有雾";
  if (code >= 51 && code <= 57) return "细雨";
  if (code >= 61 && code <= 65) return "下雨";
  if (code >= 66 && code <= 67) return "冻雨";
  if (code >= 71 && code <= 77) return "下雪";
  if (code >= 80 && code <= 82) return "阵雨";
  if (code >= 85 && code <= 86) return "阵雪";
  if (code >= 95) return "雷雨";
  return "天气平静";
}

function validCoordinate(value: string | null, min: number, max: number) {
  if (value === null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : undefined;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const latitude = validCoordinate(requestUrl.searchParams.get("latitude"), -90, 90);
  const longitude = validCoordinate(requestUrl.searchParams.get("longitude"), -180, 180);

  if (latitude === undefined || longitude === undefined) {
    return Response.json({ error: "位置参数无效。" }, { status: 400 });
  }

  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.searchParams.set("latitude", latitude.toString());
  weatherUrl.searchParams.set("longitude", longitude.toString());
  weatherUrl.searchParams.set("current", "temperature_2m,weather_code,is_day");
  weatherUrl.searchParams.set("timezone", "auto");

  try {
    const response = await fetch(weatherUrl, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return Response.json({ error: "天气服务暂时不可用。" }, { status: 502 });
    }

    const payload = (await response.json()) as {
      current?: {
        temperature_2m?: number;
        weather_code?: number;
        is_day?: number;
      };
    };
    const temperature = payload.current?.temperature_2m;
    const code = payload.current?.weather_code;
    if (!Number.isFinite(temperature) || !Number.isFinite(code)) {
      return Response.json({ error: "天气数据不完整。" }, { status: 502 });
    }

    return Response.json(
      {
        summary: weatherSummary(code as number, payload.current?.is_day !== 0),
        temperature: Math.round((temperature as number) * 10) / 10,
        updatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "天气服务暂时不可用。" }, { status: 502 });
  }
}
