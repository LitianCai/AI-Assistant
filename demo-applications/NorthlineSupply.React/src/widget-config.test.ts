import { describe, expect, it } from "vitest";
import { WIDGET_MOUNT_CONFIG } from "./widget-config";

describe("widget mount config", () => {
  it("uses only the preview fields and the preview token", () => {
    expect(Object.keys(WIDGET_MOUNT_CONFIG)).toEqual([
      "token",
      "apiBaseUrl",
      "preset",
      "display",
      "corner",
      "primaryColor",
      "brandName",
      "locale",
    ]);
    expect(WIDGET_MOUNT_CONFIG).toEqual({
      token: "preview-demo-token",
      apiBaseUrl: "preview",
      preset: "ask",
      display: "words",
      corner: "bottom-right",
      primaryColor: "#1d4ed8",
      brandName: "Northline Supply",
      locale: "en",
    });
  });
});
