import { describe, expect, it } from "vitest";
import { creditSentence, formatDate, formatMoney, isOpenInvoice, orderSummary } from "./format";
import type { Invoice } from "./api";

function invoice(overrides: Partial<Invoice>): Invoice {
  return {
    invoiceNumber: "INV-1",
    orderNumber: "22017",
    billedOn: "2026-10-29",
    status: "Paid",
    total: 10,
    balance: 0,
    ...overrides,
  };
}

describe("display formatting", () => {
  it("formats the sample order date, money, and credit sentence", () => {
    expect(formatDate("2026-09-22")).toBe("22 Sep 2026");
    expect(formatDate("2026-09-22T00:00:00Z")).toBe("22 Sep 2026");
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(creditSentence(false)).toBe("This account can order.");
    expect(
      orderSummary({
        orderNumber: "22017",
        placedOn: "2026-09-15",
        status: "Shipped",
        shippedOn: "2026-09-22",
        lineCount: 5,
        openLineCount: 1,
      }),
    ).toBe("Order 22017 shipped on 22 Sep 2026. 1 of 5 lines are still open.");
  });

  it("treats a balance or an Open status as an open invoice", () => {
    expect(isOpenInvoice(invoice({ balance: 12.5, status: "Paid" }))).toBe(true);
    expect(isOpenInvoice(invoice({ balance: 0, status: "Open" }))).toBe(true);
    expect(isOpenInvoice(invoice({ balance: 0, status: "Paid" }))).toBe(false);
  });
});
