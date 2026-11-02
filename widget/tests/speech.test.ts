/** @vitest-environment jsdom */
import { createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Assistant } from "../src/Assistant";
import { normalizeConfig } from "../src/config";
import {
  browserSpeechRecognition,
  finalTranscript,
  insertTranscript,
  startDictation,
  type RecognitionEventLike,
  type SpeechEngine,
  type SpeechEngineCtor,
} from "../src/speech";
import { WIDGET_CSS } from "../src/styles";
import { STRINGS } from "../src/strings";
import type { AssistantApi, Lang } from "../src/types";

interface HostWindow extends Window {
  SpeechRecognition?: SpeechEngineCtor;
  webkitSpeechRecognition?: SpeechEngineCtor;
}

class FakeRecognition implements SpeechEngine {
  static latest: FakeRecognition | null = null;

  lang = "";
  continuous = true;
  interimResults = true;
  onresult: ((event: RecognitionEventLike) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onend: ((event: Event) => void) | null = null;
  started = 0;
  aborted = 0;

  start(): void {
    this.started += 1;
    FakeRecognition.latest = this;
  }

  stop(): void {
    this.abort();
  }

  abort(): void {
    this.aborted += 1;
    this.onend?.(new Event("end"));
  }

  emit(event: RecognitionEventLike): void {
    this.onresult?.(event);
  }
}

function host(): HostWindow {
  return window as HostWindow;
}

function clearSpeech() {
  delete host().SpeechRecognition;
  delete host().webkitSpeechRecognition;
  FakeRecognition.latest = null;
}

function installMatchMedia(narrow: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: narrow && query.includes("max-width"),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("speech transcript editing", () => {
  it("appends a final transcript and ignores interim text", () => {
    expect(insertTranscript("", "  hello  ")).toBe("hello");
    expect(insertTranscript("   ", "hello")).toBe("hello");
    expect(insertTranscript("Order", "10482")).toBe("Order 10482");
    expect(insertTranscript("Order ", "10482")).toBe("Order 10482");
    expect(insertTranscript("Hello", "   ")).toBe("Hello");
    expect(
      finalTranscript({
        resultIndex: 1,
        results: [
          { isFinal: true, 0: { transcript: "already kept" } },
          { isFinal: false, 0: { transcript: "still guessing" } },
          { isFinal: true, 0: { transcript: " finished " } },
        ],
      }),
    ).toBe("finished");
  });

  it("uses only the standard or webkit constructor and the widget locale", () => {
    clearSpeech();
    expect(browserSpeechRecognition()).toBeNull();
    host().webkitSpeechRecognition = FakeRecognition;
    expect(browserSpeechRecognition()).toBe(FakeRecognition);
    host().SpeechRecognition = FakeRecognition;
    expect(browserSpeechRecognition()).toBe(FakeRecognition);

    const heard: string[] = [];
    let ended = 0;
    const session = startDictation(FakeRecognition, "fr", {
      onTranscript: (text) => heard.push(text),
      onEnd: () => {
        ended += 1;
      },
    });
    const engine = FakeRecognition.latest;
    expect(session?.active).toBe(true);
    expect(engine?.lang).toBe("fr");
    expect(engine?.continuous).toBe(false);
    expect(engine?.interimResults).toBe(false);
    engine?.emit({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "pas encore" } }] });
    expect(heard).toEqual([]);
    engine?.emit({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "bonjour" } }] });
    expect(heard).toEqual(["bonjour"]);
    session?.stop();
    engine?.emit({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "trop tard" } }] });
    expect(heard).toEqual(["bonjour"]);
    expect(ended).toBe(0);
    expect(engine?.aborted).toBe(1);
  });

  it("does not deliver a transcript when recognition fails to start or errors", () => {
    class Broken extends FakeRecognition {
      override start(): void {
        throw new Error("denied");
      }
    }
    const heard: string[] = [];
    expect(
      startDictation(Broken, "es", {
        onTranscript: (text) => heard.push(text),
        onEnd: () => heard.push("end"),
      }),
    ).toBeNull();
    expect(heard).toEqual([]);

    const session = startDictation(FakeRecognition, "en", {
      onTranscript: (text) => heard.push(text),
      onEnd: () => heard.push("end"),
    });
    FakeRecognition.latest?.onerror?.(new Event("error"));
    expect(session?.active).toBe(false);
    expect(heard).toEqual(["end"]);
  });
});

describe("composer microphone", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  const fetchMock = vi.fn();

  beforeEach(() => {
    clearSpeech();
    installMatchMedia(false);
    localStorage.clear();
    sessionStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearSpeech();
  });

  async function mount(locale: Lang, narrow = false): Promise<{ api: AssistantApi; sendMessage: ReturnType<typeof vi.fn> }> {
    installMatchMedia(narrow);
    const sendMessage = vi.fn(async () => ({ text: "not used", source: null }));
    const api: AssistantApi = {
      getConversation: async () => ({ messages: [] }),
      sendMessage,
    };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const element: ReactElement = createElement(Assistant, {
      config: normalizeConfig({ token: "demo", display: "words", preset: "ask" }),
      api,
      locale,
    });
    await act(async () => {
      root?.render(element);
    });
    return { api, sendMessage };
  }

  async function openPanel(): Promise<HTMLButtonElement> {
    const launcher = container?.querySelector("button.launcher");
    if (!(launcher instanceof HTMLButtonElement)) throw new Error("launcher missing");
    await act(async () => {
      launcher.click();
    });
    return launcher;
  }

  it("hides the control when the browser has no speech recognition", async () => {
    await mount("en");
    const launcher = await openPanel();
    expect(launcher.textContent).toBe("Ask");
    expect(container?.querySelector("button.dictate")).toBeNull();
    expect(container?.querySelector(".launcher button.dictate")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("writes a final transcript into the field and leaves sending to the user", async () => {
    host().SpeechRecognition = FakeRecognition;
    const { sendMessage } = await mount("fr");
    await openPanel();
    const mic = container?.querySelector("button.dictate");
    const input = container?.querySelector("input");
    const composer = container?.querySelector("form.composer");
    if (!(mic instanceof HTMLButtonElement) || !(input instanceof HTMLInputElement) || !(composer instanceof HTMLFormElement)) {
      throw new Error("composer controls missing");
    }
    expect(mic.getAttribute("aria-label")).toBe(STRINGS.fr.dictate);
    expect(mic.getAttribute("title")).toBe("Dicter");
    expect(mic.getAttribute("aria-pressed")).toBe("false");
    expect(mic.type).toBe("button");
    const labels = [...composer.querySelectorAll("input, button")].map((node) => node.getAttribute("aria-label"));
    expect(labels).toEqual([STRINGS.fr.placeholder, "Dicter", "Envoyer"]);

    await act(async () => {
      setNativeValue(input, "Bonjour");
    });
    await act(async () => {
      mic.click();
    });
    expect(mic.getAttribute("aria-pressed")).toBe("true");
    expect(FakeRecognition.latest?.lang).toBe("fr");
    await act(async () => {
      FakeRecognition.latest?.emit({
        resultIndex: 0,
        results: [{ isFinal: false, 0: { transcript: "brouillon" } }],
      });
      FakeRecognition.latest?.emit({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: " le monde" } }],
      });
    });
    expect(input.value).toBe("Bonjour le monde");
    expect(document.activeElement).toBe(input);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = vi.mocked(console.log).mock.calls.concat(vi.mocked(console.info).mock.calls, vi.mocked(console.debug).mock.calls);
    expect(JSON.stringify(logged)).not.toContain("monde");

    await act(async () => {
      setNativeValue(input, "Bonjour le monde.");
      composer.requestSubmit();
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("Bonjour le monde.", expect.any(AbortSignal));
  });

  it("stops listening when Escape closes the panel and returns focus to the launcher", async () => {
    host().webkitSpeechRecognition = FakeRecognition;
    await mount("es");
    const launcher = await openPanel();
    const mic = container?.querySelector("button.dictate");
    if (!(mic instanceof HTMLButtonElement)) throw new Error("mic missing");
    expect(mic.getAttribute("aria-label")).toBe("Dictar");
    await act(async () => {
      mic.focus();
      mic.click();
    });
    expect(document.activeElement).toBe(mic);
    expect(FakeRecognition.latest?.started).toBe(1);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });
    expect(container?.querySelector(".panel")).toBeNull();
    const restored = container?.querySelector("button.launcher");
    expect(restored).not.toBe(launcher);
    expect(document.activeElement).toBe(restored);
    expect(FakeRecognition.latest?.aborted).toBe(1);
    expect(container?.querySelector("button.dictate")).toBeNull();
  });

  it("keeps the microphone in the composer on a narrow screen", async () => {
    host().SpeechRecognition = FakeRecognition;
    await mount("en", true);
    await openPanel();
    const rootNode = container?.querySelector(".root");
    const panel = container?.querySelector(".panel");
    const mic = container?.querySelector("button.dictate");
    expect(rootNode?.getAttribute("data-narrow")).toBe("true");
    expect(panel?.contains(mic ?? null)).toBe(true);
    expect(container?.querySelector(".launcher .dictate")).toBeNull();
    expect(WIDGET_CSS).toContain("width: 100%");
    expect(WIDGET_CSS).toContain("min-width: 44px");
    expect(WIDGET_CSS).toContain('.composer button.dictate[aria-pressed="true"] .mic-icon { animation: none; }');
    if (mic instanceof HTMLElement) {
      const style = getComputedStyle(mic);
      expect(style.minWidth).toBe("44px");
      expect(style.minHeight).toBe("44px");
    }
  });
});
