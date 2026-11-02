import type { Lang } from "./types";

/** Map a BCP 47 tag. fr* / es* / en* match; anything else returns null so the caller can fall through. */
export function matchLanguage(tag: string | null | undefined): Lang | null {
  if (typeof tag !== "string") return null;
  const primary = tag.trim().toLowerCase().replace(/_/g, "-").split("-")[0] ?? "";
  if (!primary) return null;
  if (primary.startsWith("fr")) return "fr";
  if (primary.startsWith("es")) return "es";
  if (primary.startsWith("en")) return "en";
  return null;
}

export function resolveLocale(sources: {
  hostLocale?: string | null;
  documentLang?: string | null;
  navigatorLang?: string | null;
}): Lang {
  return (
    matchLanguage(sources.hostLocale) ??
    matchLanguage(sources.documentLang) ??
    matchLanguage(sources.navigatorLang) ??
    "en"
  );
}
