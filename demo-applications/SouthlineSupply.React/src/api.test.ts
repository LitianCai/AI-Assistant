import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api";

const session = {
  token: "session-token",
  displayName: "Maya Okonkwo",
  accountName: "Harbor Fabrication",
  accountNumber: "H-7781",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function headerNames(init?: RequestInit): string[] {
  return [...new Headers(init?.headers).keys()].sort();
}

describe("portal API client", () => {
  it("posts only userName when signing in", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json(session));
    let stored: string | null = "old-token";
    const api = createApiClient({
      baseUrl: "http://localhost:5090/",
      fetch: fetchMock,
      getToken: () => stored,
      setToken: (token) => {
        stored = token;
      },
    });

    const result = await api.login("maya.okonkwo");

    expect(result).toEqual(session);
    expect(stored).toBe("session-token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("http://localhost:5090/session");
    expect(init?.method).toBe("POST");
    expect(init?.credentials).toBe("omit");
    expect(JSON.parse(String(init?.body))).toEqual({ userName: "maya.okonkwo" });
    expect(headerNames(init)).toEqual(["accept", "content-type"]);
    expect(new Headers(init?.headers).get("Authorization")).toBeNull();
    expect(String(init?.body)).not.toMatch(/tenantId|companyId|accountId|accountNumber/);
  });

  it("sends the bearer token and does not add an account id", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (url) => {
      const path = new URL(String(url)).pathname;
      if (path === "/account") {
        return json({
          accountName: "Harbor Fabrication",
          accountNumber: "H-7781",
          buyerName: "Maya Okonkwo",
          creditHold: false,
        });
      }
      if (path === "/orders") return json({ orders: [] });
      if (path === "/orders/22017") {
        return json({
          orderNumber: "22017",
          placedOn: "2026-10-20",
          status: "Shipped",
          shippedOn: "2026-10-28",
          lineCount: 4,
          openLineCount: 2,
          lines: [],
        });
      }
      if (path === "/invoices") return json({ invoices: [] });
      if (path === "/catalog") return json({ items: [] });
      return json({}, 404);
    });

    const api = createApiClient({
      baseUrl: "http://localhost:5090",
      fetch: fetchMock,
      getToken: () => "session-token",
      setToken: () => undefined,
    });

    await expect(api.getAccount()).resolves.toMatchObject({ buyerName: "Maya Okonkwo" });
    await expect(api.getOrders()).resolves.toEqual([]);
    await expect(api.getOrder("22017")).resolves.toMatchObject({ orderNumber: "22017", lines: [] });
    await expect(api.getInvoices()).resolves.toEqual([]);
    await expect(api.searchCatalog("copper")).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const paths: string[] = [];
    for (const [url, init] of fetchMock.mock.calls) {
      const parsed = new URL(String(url));
      paths.push(parsed.pathname);
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe("Bearer session-token");
      expect(headers.get("Authorization")).not.toContain("preview-demo-token");
      expect(init?.method).toBe("GET");
      expect(init?.credentials).toBe("omit");
      expect(init?.body ?? null).toBeNull();
      expect(headerNames(init)).toEqual(["accept", "authorization"]);
      for (const key of ["tenantId", "companyId", "accountId", "accountNumber"]) {
        expect(parsed.searchParams.has(key)).toBe(false);
      }
      const text = String(url);
      expect(text).not.toContain("H-7781");
      expect(text).not.toContain("accountId");
      expect(text).not.toContain("tenantId");
      expect(text).not.toContain("companyId");
    }
    expect(paths).toEqual(["/account", "/orders", "/orders/22017", "/invoices", "/catalog"]);
  });

  it("searches the catalog with the q parameter", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => json({ items: [] }));
    const api = createApiClient({
      baseUrl: "http://localhost:5090",
      fetch: fetchMock,
      getToken: () => "session-token",
      setToken: () => undefined,
    });

    await api.searchCatalog("1/2 inch");
    await api.searchCatalog("");

    const first = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(first.pathname).toBe("/catalog");
    expect(first.searchParams.get("q")).toBe("1/2 inch");
    expect(first.searchParams.has("accountId")).toBe(false);

    const second = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(second.pathname).toBe("/catalog");
    expect(second.searchParams.get("q")).toBe("");
    expect(second.search).toBe("?q=");
  });
});
