import { describe, expect, it } from "vitest";
import { FALLBACK_PRIMARY, contrastRatio, resolvePrimaryColor } from "../src/color";

describe("contrast fallback", () => {
  it("keeps the brand blue because white text meets WCAG AA", () => {
    expect(contrastRatio("#ffffff", "#1d4ed8")).toBeGreaterThanOrEqual(4.5);
    expect(resolvePrimaryColor("#1d4ed8")).toBe("#1d4ed8");
    expect(resolvePrimaryColor("  #1D4ED8 ")).toBe("#1d4ed8");
    expect(resolvePrimaryColor("#000000")).toBe("#000000");
  });

  it("falls back when white text would fail contrast or the token is not hex", () => {
    expect(contrastRatio("#ffffff", "#ffffff")).toBeLessThan(4.5);
    expect(resolvePrimaryColor("#ffffff")).toBe(FALLBACK_PRIMARY);
    expect(resolvePrimaryColor("#bfdbfe")).toBe(FALLBACK_PRIMARY);
    expect(resolvePrimaryColor("#eeeeee")).toBe(FALLBACK_PRIMARY);
    expect(resolvePrimaryColor("red")).toBe(FALLBACK_PRIMARY);
    expect(resolvePrimaryColor("rgb(0, 0, 0)")).toBe(FALLBACK_PRIMARY);
    expect(resolvePrimaryColor("#fff")).toBe(FALLBACK_PRIMARY);
    expect(resolvePrimaryColor("#gggggg")).toBe(FALLBACK_PRIMARY);
    expect(resolvePrimaryColor(undefined)).toBe(FALLBACK_PRIMARY);
  });
});
