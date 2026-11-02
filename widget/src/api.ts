import { allSuggestionTexts, stringsFor } from "./strings";
import type { AssistantApi, ChatMessage, ConversationResponse, Lang, SendResponse } from "./types";

/** Generic failure. The message is not shown to the user and holds no token or transcript. */
export class SignInRequiredError extends Error {
  constructor() {
    super("Sign in required");
    this.name = "SignInRequiredError";
  }
}

export class CannotRetrieveError extends Error {
  constructor() {
    super("Cannot retrieve");
    this.name = "CannotRetrieveError";
  }
}

export const REQUEST_TIMEOUT_MS = 15_000;

const SAMPLE_QUESTION = "Has order 10482 shipped?";
const SAMPLE_ANSWER = "Order 10482 shipped on 28 Oct. 2 of 4 lines are still open.";
const SAMPLE_SOURCE = "Orders API";

export function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name: string }).name === "AbortError";
}

export function messageForFailure(error: unknown, lang: Lang): string {
  const copy = stringsFor(lang);
  if (error instanceof SignInRequiredError) return copy.signIn;
  return copy.cannotRetrieve;
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Preview transcript retention: the browser tab session only. */
const PREVIEW_KEY = "nlw:preview-messages";

function sessionStore(): KeyValueStore {
  const memory = new Map<string, string>();
  return {
    getItem(key) {
      try {
        if (typeof sessionStorage !== "undefined") return sessionStorage.getItem(key);
      } catch {
        /* Private mode. Use the page-lifetime map. */
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      try {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(key, value);
          return;
        }
      } catch {
        /* Quota or private mode. */
      }
      memory.set(key, value);
    },
  };
}

function readMessages(raw: string | null): ChatMessage[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object" || !Array.isArray((data as { messages?: unknown }).messages)) return [];
    const messages: ChatMessage[] = [];
    for (const item of (data as { messages: unknown[] }).messages) {
      const parsed = tryMessage(item);
      if (parsed) messages.push(parsed);
    }
    return messages;
  } catch {
    return [];
  }
}

function tryMessage(item: unknown): ChatMessage | null {
  if (!item || typeof item !== "object") return null;
  const role = (item as { role?: unknown }).role;
  const text = (item as { text?: unknown }).text;
  const source = (item as { source?: unknown }).source;
  if ((role !== "user" && role !== "assistant") || typeof text !== "string") return null;
  return {
    role,
    text,
    source: typeof source === "string" && source.trim() ? source.trim() : null,
  };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function replyFor(text: string, locale: Lang): SendResponse {
  if (text === SAMPLE_QUESTION) {
    return { text: SAMPLE_ANSWER, source: SAMPLE_SOURCE };
  }
  const copy = stringsFor(locale);
  const lower = text.toLowerCase();
  const asksForAccountFact =
    lower.includes("order") || lower.includes("price") || lower.includes("invoice");
  if (allSuggestionTexts().includes(text) || !asksForAccountFact) {
    return { text: copy.previewLine, source: null };
  }
  return { text: copy.cannotRetrieve, source: null };
}

/** In-browser stand-in. The only factual answer is the design sample for order 10482. */
export class PreviewApi implements AssistantApi {
  private readonly delayMs: number;
  private readonly store: KeyValueStore;

  constructor(
    private readonly locale: Lang,
    options?: { store?: KeyValueStore; delayMs?: number },
  ) {
    this.delayMs = options?.delayMs ?? 650;
    this.store = options?.store ?? sessionStore();
  }

  async getConversation(signal?: AbortSignal): Promise<ConversationResponse> {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return { messages: readMessages(this.store.getItem(PREVIEW_KEY)) };
  }

  async sendMessage(text: string, signal?: AbortSignal): Promise<SendResponse> {
    await wait(this.delayMs, signal);
    const trimmed = text.trim();
    const reply = replyFor(trimmed, this.locale);
    const messages = readMessages(this.store.getItem(PREVIEW_KEY));
    messages.push({ role: "user", text: trimmed, source: null });
    messages.push({ role: "assistant", text: reply.text, source: reply.source });
    this.store.setItem(PREVIEW_KEY, JSON.stringify({ messages }));
    return reply;
  }
}

function endpoint(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}${path}`;
}

function authorizationHeader(token: string): string {
  const value = token.trim();
  if (!value || /[\r\n\0]/.test(value)) throw new SignInRequiredError();
  return `Bearer ${value}`;
}

async function discard(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    /* The status is already known. */
  }
}

/**
 * Stops calling a client API that keeps failing so the widget does not hang.
 * An open circuit rejects immediately with the cannot-retrieve path.
 */
class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly limit = 3,
    private readonly cooldownMs = 30_000,
  ) {}

  allow(now = Date.now()): boolean {
    return now >= this.openUntil;
  }

  succeed(): void {
    this.failures = 0;
    this.openUntil = 0;
  }

  fail(now = Date.now()): void {
    this.failures += 1;
    if (this.failures >= this.limit) {
      this.openUntil = now + this.cooldownMs;
      this.failures = 0;
    }
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, parent?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onParentAbort = () => controller.abort();
  parent?.addEventListener("abort", onParentAbort);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", onParentAbort);
  }
}

function parseSend(data: unknown): SendResponse {
  const message = tryMessage({ ...(typeof data === "object" && data ? data : {}), role: "assistant" });
  if (!message) throw new CannotRetrieveError();
  return { text: message.text, source: message.source };
}

function parseConversation(data: unknown): ConversationResponse {
  if (!data || typeof data !== "object" || !Array.isArray((data as { messages?: unknown }).messages)) {
    throw new CannotRetrieveError();
  }
  const messages: ChatMessage[] = [];
  for (const item of (data as { messages: unknown[] }).messages) {
    const parsed = tryMessage(item);
    if (parsed) messages.push(parsed);
  }
  return { messages };
}

/** HTTP client for the real API. This package does not implement that server. */
export class HttpAssistantApi implements AssistantApi {
  private readonly breaker = new CircuitBreaker();

  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  getConversation(signal?: AbortSignal): Promise<ConversationResponse> {
    return this.request("GET", "/conversation", undefined, signal, parseConversation);
  }

  sendMessage(text: string, signal?: AbortSignal): Promise<SendResponse> {
    return this.request("POST", "/messages", { text }, signal, parseSend);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body: { text: string } | undefined,
    signal: AbortSignal | undefined,
    parser: (data: unknown) => T,
  ): Promise<T> {
    if (!this.breaker.allow()) throw new CannotRetrieveError();
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: authorizationHeader(this.token),
    };
    if (body) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetchWithTimeout(
        endpoint(this.baseUrl, path),
        {
          method,
          credentials: "omit",
          redirect: "error",
          cache: "no-store",
          headers,
          body: body ? JSON.stringify(body) : undefined,
        },
        signal,
      );
    } catch (error) {
      if (isAbortError(error) && signal?.aborted) throw error;
      this.breaker.fail();
      throw new CannotRetrieveError();
    }

    if (signal?.aborted) {
      await discard(response);
      throw new DOMException("Aborted", "AbortError");
    }
    if (response.status === 401) {
      await discard(response);
      throw new SignInRequiredError();
    }
    if (!response.ok) {
      await discard(response);
      this.breaker.fail();
      throw new CannotRetrieveError();
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (error) {
      if (isAbortError(error) && signal?.aborted) throw error;
      this.breaker.fail();
      throw new CannotRetrieveError();
    }

    try {
      const parsed = parser(data);
      this.breaker.succeed();
      return parsed;
    } catch {
      this.breaker.fail();
      throw new CannotRetrieveError();
    }
  }
}

export function createAssistantApi(options: {
  token: string;
  apiBaseUrl?: string;
  locale: Lang;
}): AssistantApi {
  const base = options.apiBaseUrl?.trim() ?? "";
  if (!base || base.toLowerCase() === "preview") return new PreviewApi(options.locale);
  return new HttpAssistantApi(base, options.token);
}
