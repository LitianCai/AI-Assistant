export const PRIMARY_FALLBACK = '#1d4ed8';

const HEX = /^#[0-9a-f]{6}$/i;

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolvePrimaryColor(input: string | undefined): string {
  if (!input || !HEX.test(input)) return PRIMARY_FALLBACK;
  const hex = input.toLowerCase();
  if (contrastRatio('#ffffff', hex) < 4.5) return PRIMARY_FALLBACK;
  return hex;
}

function relativeLuminance(hex: string): number {
  const red = linear(Number.parseInt(hex.slice(1, 3), 16));
  const green = linear(Number.parseInt(hex.slice(3, 5), 16));
  const blue = linear(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function linear(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}
