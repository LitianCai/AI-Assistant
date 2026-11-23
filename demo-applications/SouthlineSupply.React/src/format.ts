import type { Account, CatalogSubstitute, Invoice, OrderSummary } from "./api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

// [ASSUMED] Money from the distributor API is USD.
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const label = MONTHS[month - 1];
  if (!label || day < 1 || day > 31) return value;
  return `${day} ${label} ${match[1]}`;
}

export function formatMoney(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return usd.format(value);
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return String(value);
}

export function formatPlain(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

// [ASSUMED] When creditHold is true the sentence is "This account is on credit hold."
export function creditSentence(creditHold: boolean): string {
  return creditHold ? "This account is on credit hold." : "This account can order.";
}

export function orderSummary(order: OrderSummary): string | null {
  if (typeof order.lineCount !== "number" || typeof order.openLineCount !== "number") return null;
  const open = `${order.openLineCount} of ${order.lineCount} lines are still open.`;
  if (order.shippedOn) {
    const shipped = formatDate(order.shippedOn);
    if (!shipped) return null;
    return `Order ${order.orderNumber} shipped on ${shipped}. ${open}`;
  }
  if (order.status) return `Order ${order.orderNumber} is ${order.status}. ${open}`;
  return `Order ${order.orderNumber}. ${open}`;
}

// [ASSUMED] An invoice is open when its balance is above zero or its status is Open.
export function isOpenInvoice(invoice: Invoice): boolean {
  if (typeof invoice.balance === "number" && invoice.balance > 0) return true;
  return typeof invoice.status === "string" && invoice.status.trim().toLowerCase() === "open";
}

export function customerLine(account: Account): string {
  return [account.buyerName, account.accountName, account.accountNumber]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim())
    .join(" · ");
}

export function substituteLabels(substitutes: CatalogSubstitute[] | null | undefined): string[] {
  if (!Array.isArray(substitutes)) return [];
  const labels: string[] = [];
  for (const item of substitutes) {
    if (typeof item === "string") {
      const text = item.trim();
      if (text) labels.push(text);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const sku = typeof item.sku === "string" ? item.sku.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (sku && name) labels.push(`${sku} (${name})`);
    else if (sku) labels.push(sku);
    else if (name) labels.push(name);
  }
  return labels;
}
