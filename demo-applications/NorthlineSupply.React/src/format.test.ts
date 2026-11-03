import { describe, expect, it } from "vitest";
import { creditSentence, formatDate, formatMoney, isOpenInvoice, orderSummary } from "./format";
import type { Invoice } from "./api";

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    invoiceNumber: "INV-1",
    orderNumber: "10482",
    billedOn: "2026-10-29",
    status: "Paid",
    total: 10,
    balance: 0,
    ...overrides,
  };
}

describe("display formatting", () => {
  it("formats the sample order date, money, and credit sentence", () => {
    expect(formatDate("2026-10-28")).toBe("28 Oct 2026");
    expect(formatDate("2026-10-28T00:00:00Z")).toBe("28 Oct 2026");
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(creditSentence(false)).toBe("This account can order.");
    expect(
      orderSummary({
        orderNumber: "10482",
        placedOn: "2026-10-20",
        status: "Shipped",
        shippedOn: "2026-10-28",
        lineCount: 4,
        openLineCount: 2,
      }),
    ).toBe("Order 10482 shipped on 28 Oct 2026. 2 of 4 lines are still open.");
  });

  it("treats a balance or an Open status as an open invoice", () => {
    expect(isOpenInvoice(invoice({ balance: 12.5, status: "Paid" }))).toBe(true);
    expect(isOpenInvoice(invoice({ balance: 0, status: "Open" }))).toBe(true);
    expect(isOpenInvoice(invoice({ balance: 0, status: "Paid" }))).toBe(false);
  });
});
