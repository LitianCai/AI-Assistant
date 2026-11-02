import { describe, expect, it } from "vitest";
import { matchLanguage, resolveLocale } from "../src/locale";

describe("language resolution", () => {
  it("maps French, Spanish, and English tags including regions", () => {
    expect(matchLanguage("fr")).toBe("fr");
    expect(matchLanguage("fr-CA")).toBe("fr");
    expect(matchLanguage("FR_fr")).toBe("fr");
    expect(matchLanguage("es-MX")).toBe("es");
    expect(matchLanguage("ES")).toBe("es");
    expect(matchLanguage("en-GB")).toBe("en");
    expect(matchLanguage("en")).toBe("en");
  });

  it("returns null for unknown tags so the next source can run", () => {
    expect(matchLanguage("de")).toBeNull();
    expect(matchLanguage("pt-BR")).toBeNull();
    expect(matchLanguage("")).toBeNull();
    expect(matchLanguage("   ")).toBeNull();
    expect(matchLanguage(undefined)).toBeNull();
  });

  it("uses host locale, then the page, then the browser, then English", () => {
    expect(resolveLocale({ hostLocale: "fr-CA", documentLang: "en", navigatorLang: "es" })).toBe("fr");
    expect(resolveLocale({ hostLocale: "de", documentLang: "es-MX", navigatorLang: "en" })).toBe("es");
    expect(resolveLocale({ hostLocale: "de", documentLang: "pt", navigatorLang: "en-US" })).toBe("en");
    expect(resolveLocale({ hostLocale: "", documentLang: "", navigatorLang: "fr" })).toBe("fr");
    expect(resolveLocale({ hostLocale: "de", documentLang: "ja", navigatorLang: "zh-CN" })).toBe("en");
    expect(resolveLocale({})).toBe("en");
  });
});
