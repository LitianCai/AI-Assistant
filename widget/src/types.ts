export type Preset = "ask" | "help" | "question" | "chat" | "info";
export type Display = "words" | "icon";
export type Corner = "bottom-right" | "bottom-left" | "top-right" | "top-left";
export type Lang = "en" | "fr" | "es";

/** Host options. Unknown preset, display, and corner values fall back at runtime. */
export interface AiAssistantConfig {
  /** Sent only as Authorization: Bearer. Never a tenant, company, or user id. */
  token: string;
  /** Omit or "preview" to use the in-browser preview adapter. */
  apiBaseUrl?: string;
  preset?: string;
  display?: string;
  corner?: string;
  /** Hex color. White text must meet WCAG AA 4.5:1 or the widget uses #1d4ed8. */
  primaryColor?: string;
  /** Plain text. Tags are stripped and the value is capped at 40 characters. */
  brandName?: string;
  /** Host locale. Unknown tags fall through to the page, then the browser, then English. */
  locale?: string;
}

export interface MountedAssistant {
  unmount(): void;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  source: string | null;
}

export interface ConversationResponse {
  messages: ChatMessage[];
}

export interface SendResponse {
  text: string;
  source: string | null;
}

export interface AssistantApi {
  getConversation(signal?: AbortSignal): Promise<ConversationResponse>;
  sendMessage(text: string, signal?: AbortSignal): Promise<SendResponse>;
}
