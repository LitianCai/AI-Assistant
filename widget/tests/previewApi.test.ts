import { describe, expect, it } from "vitest";
import { PreviewApi } from "../src/api";
import { STRINGS } from "../src/strings";

function memoryStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("preview answers", () => {
  it("returns the design sample only for the exact order question", async () => {
    const api = new PreviewApi("en", { store: memoryStore(), delayMs: 0 });
    const reply = await api.sendMessage("Has order 10482 shipped?");
    expect(reply).toEqual({
      text: "Order 10482 shipped on 28 Oct. 2 of 4 lines are still open.",
      source: "Orders API",
    });
  });

  it("does not invent an answer for a different order, price, or invoice question", async () => {
    const api = new PreviewApi("en", { store: memoryStore(), delayMs: 0 });
    const order = await api.sendMessage("Has order 10483 shipped?");
    const price = await api.sendMessage("What is the price of cable?");
    const invoice = await api.sendMessage("Show invoice 900");
    expect(order).toEqual({ text: STRINGS.en.cannotRetrieve, source: null });
    expect(price).toEqual({ text: STRINGS.en.cannotRetrieve, source: null });
    expect(invoice).toEqual({ text: STRINGS.en.cannotRetrieve, source: null });
    expect(order.text).not.toMatch(/10483|\$|28 Oct/);
  });

  it("answers suggested questions with a non-factual preview line", async () => {
    const api = new PreviewApi("fr", { store: memoryStore(), delayMs: 0 });
    const reply = await api.sendMessage("Que puis-je faire ?");
    expect(reply.source).toBeNull();
    expect(reply.text).toBe(STRINGS.fr.previewLine);
    expect(reply.text).not.toMatch(/\d/);
  });

  it("restores messages from the same session store", async () => {
    const store = memoryStore();
    const first = new PreviewApi("en", { store, delayMs: 0 });
    await first.sendMessage("What can you do?");
    const restored = await new PreviewApi("en", { store, delayMs: 0 }).getConversation();
    expect(restored.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(restored.messages[1]?.text).toBe(STRINGS.en.previewLine);
    expect(restored.messages[1]?.source).toBeNull();
  });
});
