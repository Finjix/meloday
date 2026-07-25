import type { CompanionPreferences } from "@/lib/types";

const preferenceStorageKey = "meloday.companion-preferences.v1";

export const defaultCompanionPreferences: CompanionPreferences = {
  nickname: "",
  replyStyle: "gentle",
  soundStyle: "warm",
  autoPlayEntry: false,
};

export function normalizeCompanionPreferences(value: unknown): CompanionPreferences {
  const input =
    value && typeof value === "object"
      ? (value as Partial<CompanionPreferences>)
      : {};

  return {
    nickname:
      typeof input.nickname === "string"
        ? input.nickname.trim().slice(0, 12)
        : "",
    replyStyle:
      input.replyStyle === "concise" || input.replyStyle === "direct"
        ? input.replyStyle
        : "gentle",
    soundStyle:
      input.soundStyle === "clear" || input.soundStyle === "deep"
        ? input.soundStyle
        : "warm",
    autoPlayEntry: input.autoPlayEntry === true,
  };
}

export function loadCompanionPreferences() {
  if (typeof window === "undefined") return defaultCompanionPreferences;

  try {
    return normalizeCompanionPreferences(
      JSON.parse(window.localStorage.getItem(preferenceStorageKey) || "{}"),
    );
  } catch {
    return defaultCompanionPreferences;
  }
}

export function saveCompanionPreferences(preferences: CompanionPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    preferenceStorageKey,
    JSON.stringify(normalizeCompanionPreferences(preferences)),
  );
}
