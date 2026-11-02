import { describe, expect, it } from "vitest";
import { FALLBACK_PRIMARY } from "../src/color";
import { normalizeConfig, sanitizeBrandName } from "../src/config";

describe("preset and color rejection", () => {
  it("falls back for unknown preset, display, and corner", () => {
    const config = normalizeConfig({
      token: "demo",
      preset: "compact",
      display: "both",
      corner: "center",
    });
    expect(config.preset).toBe("ask");
    expect(config.display).toBe("words");
    expect(config.corner).toBe("bottom-right");
  });

  it("keeps known values and ignores case", () => {
    const config = normalizeConfig({
      token: "demo",
      preset: "Question",
      display: "ICON",
      corner: "Top-Left",
    });
    expect(config.preset).toBe("question");
    expect(config.display).toBe("icon");
    expect(config.corner).toBe("top-left");
  });

  it("rejects a low-contrast or non-hex primary color", () => {
    expect(normalizeConfig({ token: "demo", primaryColor: "#ffffff" }).primaryColor).toBe(FALLBACK_PRIMARY);
    expect(normalizeConfig({ token: "demo", primaryColor: "blue" }).primaryColor).toBe(FALLBACK_PRIMARY);
    expect(normalizeConfig({ token: "demo", primaryColor: "#1d4ed8" }).primaryColor).toBe("#1d4ed8");
  });

  it("strips tags from the brand name and caps the length", () => {
    expect(sanitizeBrandName("<b>Northline</b> Supply")).toBe("Northline Supply");
    expect(sanitizeBrandName("<img src=x onerror=alert(1)>")).toBe("Assistant");
    expect(sanitizeBrandName(`<script>alert(1)</script>Hi`)).toBe("alert(1) Hi");
    expect(normalizeConfig({ token: "demo", brandName: `<i>${"A".repeat(50)}</i>` }).brandName).toHaveLength(40);
    expect(normalizeConfig({ token: "demo" }).brandName).toBe("Assistant");
  });

  it("keeps an unknown host locale so resolution can fall through", () => {
    expect(normalizeConfig({ token: "demo", locale: "de" }).locale).toBe("de");
    expect(normalizeConfig({ token: "demo", locale: "  " }).locale).toBeUndefined();
  });
});
