/** Safe brand color when a host token is missing, invalid, or below WCAG AA. */
export const FALLBACK_PRIMARY = "#1d4ed8";
export const ON_PRIMARY = "#ffffff";
export const MIN_TEXT_CONTRAST = 4.5;

const HEX = /^#([0-9a-f]{6})$/i;

/** Normalize #RRGGBB. Shorthand, named colors, and other CSS are rejected. */
export function parseHex(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;
  const match = HEX.exec(input.trim());
  if (!match) return null;
  return `#${match[1].toLowerCase()}`;
}

function linearize(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const normalized = parseHex(hex);
  if (!normalized) return 0;
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

/** Contrast ratio of two #RRGGBB colors. Invalid input yields 1. */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Keep the host color only when white text on it meets WCAG AA 4.5:1. */
export function resolvePrimaryColor(input: string | null | undefined): string {
  const hex = parseHex(input);
  if (!hex) return FALLBACK_PRIMARY;
  if (contrastRatio(ON_PRIMARY, hex) < MIN_TEXT_CONTRAST) return FALLBACK_PRIMARY;
  return hex;
}
