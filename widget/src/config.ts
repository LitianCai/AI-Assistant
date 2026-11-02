import { resolvePrimaryColor } from "./color";
import type { AiAssistantConfig, Corner, Display, Preset } from "./types";

const PRESETS: readonly Preset[] = ["ask", "help", "question", "chat", "info"];
const DISPLAYS: readonly Display[] = ["words", "icon"];
const CORNERS: readonly Corner[] = ["bottom-right", "bottom-left", "top-right", "top-left"];
// [ASSUMED] Brand name is at most 40 characters; an omitted name is "Assistant".
const BRAND_MAX = 40;

export interface NormalizedConfig {
  token: string;
  apiBaseUrl?: string;
  preset: Preset;
  display: Display;
  corner: Corner;
  primaryColor: string;
  brandName: string;
  locale?: string;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  if (typeof value !== "string") return fallback;
  const key = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(key) ? (key as T) : fallback;
}

/** Plain text only. Tags are removed. Empty results use a generic name. */
export function sanitizeBrandName(value: string | undefined): string {
  if (typeof value !== "string") return "Assistant";
  const withoutTags = value.replace(/<[^>]*>/g, " ");
  const plain = withoutTags.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) return "Assistant";
  return Array.from(plain).slice(0, BRAND_MAX).join("");
}

export function normalizeConfig(input: Partial<AiAssistantConfig> | null | undefined): NormalizedConfig {
  const token = typeof input?.token === "string" ? input.token.trim() : "";
  const rawBase = typeof input?.apiBaseUrl === "string" ? input.apiBaseUrl.trim() : "";
  const locale = typeof input?.locale === "string" && input.locale.trim() ? input.locale.trim() : undefined;
  return {
    token,
    apiBaseUrl: rawBase || undefined,
    preset: oneOf(input?.preset, PRESETS, "ask"),
    display: oneOf(input?.display, DISPLAYS, "words"),
    corner: oneOf(input?.corner, CORNERS, "bottom-right"),
    primaryColor: resolvePrimaryColor(input?.primaryColor),
    brandName: sanitizeBrandName(input?.brandName),
    locale,
  };
}

/** Host config with safe defaults. Omitted API base means the preview adapter. */
export function resolveConfig(input?: Partial<AiAssistantConfig> | null): NormalizedConfig {
  const normalized = normalizeConfig(input);
  return {
    ...normalized,
    apiBaseUrl: normalized.apiBaseUrl ?? "preview",
  };
}
