import { afterEach, describe, expect, it, vi } from "vitest";
import { CannotRetrieveError, HttpAssistantApi, REQUEST_TIMEOUT_MS, SignInRequiredError } from "../src/api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
});

describe("HTTP client", () => {
  it("sends the bearer token and a body that is only the message text", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ text: "Ready", source: "Orders API" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const api = new HttpAssistantApi("https://example.test/base/", "demo-token");
    const reply = await api.sendMessage("hello");

    expect(reply).toEqual({ text: "Ready", source: "Orders API" });
    expect(calls[0]?.url).toBe("https://example.test/base/messages");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer demo-token");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ text: "hello" });
    expect(String(calls[0]?.init?.body)).not.toMatch(/tenant|company|user/i);
    expect([...headers.keys()]).not.toContain("x-tenant-id");
  });

  it("maps 401 to sign-in and 5xx or network errors to cannot-retrieve", async () => {
    globalThis.fetch = (async () => new Response("no", { status: 401 })) as typeof fetch;
    const denied = new HttpAssistantApi("https://example.test", "secret-token");
    await expect(denied.getConversation()).rejects.toBeInstanceOf(SignInRequiredError);

    globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
    const down = new HttpAssistantApi("https://example.test", "secret-token");
    await expect(down.sendMessage("hello")).rejects.toBeInstanceOf(CannotRetrieveError);

    globalThis.fetch = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    const offline = new HttpAssistantApi("https://example.test", "secret-token");
    await expect(offline.getConversation()).rejects.toBeInstanceOf(CannotRetrieveError);
  });

  it("stops at the timeout instead of hanging", async () => {
    vi.useFakeTimers();
    globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      })) as typeof fetch;

    const api = new HttpAssistantApi("https://example.test", "tok");
    const pending = api.getConversation();
    const assertion = expect(pending).rejects.toBeInstanceOf(CannotRetrieveError);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
  });
});
