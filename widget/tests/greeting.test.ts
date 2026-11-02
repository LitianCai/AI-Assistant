import { describe, expect, it } from "vitest";
import { canShowGreeting } from "../src/greeting";

const today = "2026-11-01";

describe("greeting visibility", () => {
  it("shows on a first visit", () => {
    expect(
      canShowGreeting({
        reduceMotion: false,
        opened: false,
        shownThisSession: false,
        lastShownDay: null,
        today,
      }),
    ).toBe(true);
  });

  it("stays hidden for reduced motion, an opened panel, this session, or the same day", () => {
    expect(canShowGreeting({ reduceMotion: true, opened: false, shownThisSession: false, lastShownDay: null, today })).toBe(
      false,
    );
    expect(canShowGreeting({ reduceMotion: false, opened: true, shownThisSession: false, lastShownDay: null, today })).toBe(
      false,
    );
    expect(canShowGreeting({ reduceMotion: false, opened: false, shownThisSession: true, lastShownDay: null, today })).toBe(
      false,
    );
    expect(
      canShowGreeting({ reduceMotion: false, opened: false, shownThisSession: false, lastShownDay: today, today }),
    ).toBe(false);
  });

  it("allows one more appearance on a later day when the panel was never opened", () => {
    expect(
      canShowGreeting({
        reduceMotion: false,
        opened: false,
        shownThisSession: false,
        lastShownDay: "2026-10-31",
        today,
      }),
    ).toBe(true);
  });
});
