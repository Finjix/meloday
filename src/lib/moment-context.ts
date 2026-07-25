import type { MomentContext, MomentWeather } from "@/lib/types";

const weatherStorageKey = "meloday.moment-weather.v1";
const weatherFreshnessMs = 6 * 60 * 60 * 1000;

function isMomentWeather(value: unknown): value is MomentWeather {
  if (!value || typeof value !== "object") return false;
  const weather = value as Partial<MomentWeather>;
  return Boolean(
    typeof weather.summary === "string" &&
      typeof weather.temperature === "number" &&
      Number.isFinite(weather.temperature) &&
      typeof weather.updatedAt === "string",
  );
}

export function loadMomentWeather(): MomentWeather | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(weatherStorageKey) || "null");
    if (!isMomentWeather(parsed)) return undefined;
    const age = Date.now() - new Date(parsed.updatedAt).getTime();
    return age >= 0 && age <= weatherFreshnessMs ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function timeOfDay(hour: number): MomentContext["timeOfDay"] {
  if (hour < 6) return "深夜";
  if (hour < 11) return "上午";
  if (hour < 14) return "中午";
  if (hour < 18) return "下午";
  if (hour < 22) return "晚上";
  return "深夜";
}

function localDateParts(now: Date) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return {
    localDate: `${year}-${month}-${day}`,
    localTime: `${hour}:${minute}`,
  };
}

export function getMomentContext(now = new Date()): MomentContext {
  const parts = localDateParts(now);
  return {
    ...parts,
    timeOfDay: timeOfDay(now.getHours()),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
    weather: loadMomentWeather(),
  };
}

function requestDevicePosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("当前设备无法读取位置，天气不会加入这次创作。"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 30 * 60 * 1000,
    });
  });
}

export async function refreshMomentWeather(): Promise<MomentWeather> {
  if (typeof window === "undefined") {
    throw new Error("天气只能在当前设备上更新。");
  }

  let position: GeolocationPosition;
  try {
    position = await requestDevicePosition();
  } catch (error) {
    const positionError =
      error && typeof error === "object"
        ? (error as Partial<GeolocationPositionError>)
        : undefined;
    if (positionError?.code === 1) {
      throw new Error("没有获得位置权限，天气不会加入这次创作。");
    }
    throw error instanceof Error
      ? error
      : new Error("暂时没有读到位置，稍后再试一次。");
  }

  const query = new URLSearchParams({
    latitude: position.coords.latitude.toFixed(3),
    longitude: position.coords.longitude.toFixed(3),
  });
  const response = await fetch("/api/weather?" + query.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("天气暂时没有更新，可以稍后再试。");
  }

  const payload = (await response.json()) as Partial<MomentWeather>;
  if (!isMomentWeather(payload)) {
    throw new Error("这次没有读到完整天气，可以稍后再试。");
  }

  window.localStorage.setItem(weatherStorageKey, JSON.stringify(payload));
  return payload;
}
