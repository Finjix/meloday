import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { getMomentContext, loadMomentWeather } from "./moment-context.ts";

const values = new Map<string, string>();

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    },
  },
});

beforeEach(() => values.clear());

test("moment context uses the device date and time of day", () => {
  const context = getMomentContext(new Date(2026, 6, 16, 15, 30));
  assert.equal(context.localDate, "2026-07-16");
  assert.equal(context.localTime, "15:30");
  assert.equal(context.timeOfDay, "下午");
  assert.equal(context.weather, undefined);
});

test("fresh weather is used and stale weather is ignored", () => {
  values.set(
    "meloday.moment-weather.v1",
    JSON.stringify({
      summary: "小雨",
      temperature: 24.6,
      updatedAt: new Date().toISOString(),
    }),
  );
  assert.deepEqual(loadMomentWeather()?.summary, "小雨");

  values.set(
    "meloday.moment-weather.v1",
    JSON.stringify({
      summary: "晴朗",
      temperature: 30,
      updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    }),
  );
  assert.equal(loadMomentWeather(), undefined);
});
