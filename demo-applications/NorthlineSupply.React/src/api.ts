// The browser sends the signed-in user's token and never an account or tenant id.
// The server binds the account from that token.

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// [ASSUMED] Each call aborts after 10 seconds so a stalled API cannot hang the page.
// This portal has no configured handoff, so a timeout or a dead API shows a plain error.
export const API_TIMEOUT_MS = 10_000;

const SCOPE_KEYS = ["tenantId", "companyId", "accountId", "accountNumber"] as const;

export interface Session {
  token: string;
  displayName: string;
  accountName: string;
  accountNumber: string;
}

export interface Account {
  accountName: string;
  accountNumber: string;
  buyerName: string;
  creditHold: boolean;
}

export interface OrderSummary {
  orderNumber: string;
  placedOn: string;
  status: string;
  shippedOn: string | null;
  lineCount: number;
  openLineCount: number;
}

export interface OrderLine {
  sku: string;
  name: string;
  material: string;
  size: string;
  quantity: number;
  status: string;
  promiseDate: string | null;
  unitPrice: number;
  available: number;
  allocated: number;
}

export interface OrderDetail extends OrderSummary {
  lines: OrderLine[];
}

export interface Invoice {
  invoiceNumber: string;
  orderNumber: string;
  billedOn: string;
  status: string;
  total: number;
  balance: number;
}

// [ASSUMED] A substitute is a SKU string, or an object with sku and name.
export type CatalogSubstitute = string | { sku?: string; name?: string };

export interface CatalogItem {
  sku: string;
  name: string;
  material: string;
  size: string;
  pressure: string | number;
  unitPrice: number;
  available: number;
  allocated: number;
  substitutes?: CatalogSubstitute[];
}

export interface PortalApi {
  login(userName: string): Promise<Session>;
  getAccount(signal?: AbortSignal): Promise<Account>;
  getOrders(signal?: AbortSignal): Promise<OrderSummary[]>;
  getOrder(orderNumber: string, signal?: AbortSignal): Promise<OrderDetail>;
  getInvoices(signal?: AbortSignal): Promise<Invoice[]>;
  searchCatalog(query: string, signal?: AbortSignal): Promise<CatalogItem[]>;
}

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  getToken: () => string | null;
  setToken: (token: string) => void;
}

function rootUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function assertNoScope(url: string, body?: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ApiError("The API is unreachable.");
  }
  for (const key of SCOPE_KEYS) {
    if (parsed.searchParams.has(key)) {
      throw new Error("Refusing to send an account or tenant id.");
    }
  }
  if (!body) return;
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return;
  }
  if (!payload || typeof payload !== "object") return;
  for (const key of SCOPE_KEYS) {
    if (key in payload) {
      throw new Error("Refusing to send an account or tenant id.");
    }
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError("The API returned an unexpected response.");
  }
}

export function createApiClient(options: ApiClientOptions): PortalApi {
  const fetchImpl: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const base = rootUrl(options.baseUrl);

  async function send(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    assertNoScope(url, typeof init.body === "string" ? init.body : undefined);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      if (signal?.aborted) {
        throw new DOMException("The request was aborted.", "AbortError");
      }
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (response.status >= 500) {
        throw new ApiError("The API is unreachable.");
      }
      if (!response.ok) {
        throw new ApiError("The API returned an error.");
      }
      return response;
    } catch (error) {
      if (signal?.aborted) {
        throw error instanceof Error ? error : new DOMException("The request was aborted.", "AbortError");
      }
      if (error instanceof ApiError) throw error;
      if (isAbortError(error)) throw new ApiError("The API is unreachable.");
      throw new ApiError("The API is unreachable.");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  function authorizedGet(url: string, signal?: AbortSignal): Promise<Response> {
    const token = options.getToken();
    if (!token) throw new ApiError("Sign in to continue.");
    const headers = new Headers();
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${token}`);
    return send(url, { method: "GET", headers, credentials: "omit", cache: "no-store" }, signal);
  }

  return {
    async login(userName) {
      const body = JSON.stringify({ userName });
      const headers = new Headers();
      headers.set("Accept", "application/json");
      headers.set("Content-Type", "application/json");
      const response = await send(`${base}/session`, {
        method: "POST",
        headers,
        body,
        credentials: "omit",
        cache: "no-store",
      });
      const payload = await readBody(response);
      if (!isRecord(payload) || typeof payload.token !== "string" || payload.token.length === 0) {
        throw new ApiError("The API returned an unexpected response.");
      }
      options.setToken(payload.token);
      return {
        token: payload.token,
        displayName: typeof payload.displayName === "string" ? payload.displayName : "",
        accountName: typeof payload.accountName === "string" ? payload.accountName : "",
        accountNumber: typeof payload.accountNumber === "string" ? payload.accountNumber : "",
      };
    },

    async getAccount(signal) {
      const response = await authorizedGet(`${base}/account`, signal);
      const payload = await readBody(response);
      if (!isRecord(payload)) throw new ApiError("The API returned an unexpected response.");
      return payload as unknown as Account;
    },

    async getOrders(signal) {
      const response = await authorizedGet(`${base}/orders`, signal);
      const payload = await readBody(response);
      if (!isRecord(payload) || !Array.isArray(payload.orders)) {
        throw new ApiError("The API returned an unexpected response.");
      }
      return payload.orders as OrderSummary[];
    },

    async getOrder(orderNumber, signal) {
      const response = await authorizedGet(`${base}/orders/${encodeURIComponent(orderNumber)}`, signal);
      const payload = await readBody(response);
      if (!isRecord(payload) || !Array.isArray(payload.lines)) {
        throw new ApiError("The API returned an unexpected response.");
      }
      return payload as unknown as OrderDetail;
    },

    async getInvoices(signal) {
      const response = await authorizedGet(`${base}/invoices`, signal);
      const payload = await readBody(response);
      if (!isRecord(payload) || !Array.isArray(payload.invoices)) {
        throw new ApiError("The API returned an unexpected response.");
      }
      return payload.invoices as Invoice[];
    },

    async searchCatalog(query, signal) {
      const params = new URLSearchParams();
      params.set("q", query);
      const response = await authorizedGet(`${base}/catalog?${params.toString()}`, signal);
      const payload = await readBody(response);
      if (!isRecord(payload) || !Array.isArray(payload.items)) {
        throw new ApiError("The API returned an unexpected response.");
      }
      return payload.items as CatalogItem[];
    },
  };
}
