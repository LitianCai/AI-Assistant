import { mountAiAssistant, type MountedAssistant } from "./embed";

// [ASSUMED] The preview page uses the demo token "preview-demo-token" unless live mode is on.
const DEMO_TOKEN = "preview-demo-token";

// [ASSUMED] Dev-only live mode: open the preview with ?live=1 to call the local Assistant API.
// The token comes from the Development-only /dev/token endpoint. It is never written to the build.
const LIVE_API_BASE = "https://localhost:7091";
const live = import.meta.env.DEV && new URLSearchParams(window.location.search).get("live") === "1";

interface PreviewSession {
  token: string;
  apiBaseUrl: string;
}

let session: PreviewSession = { token: DEMO_TOKEN, apiBaseUrl: "preview" };

async function fetchDevToken(): Promise<string> {
  const response = await fetch(`${LIVE_API_BASE}/dev/token`, { method: "POST", cache: "no-store" });
  if (!response.ok) throw new Error("Dev token unavailable");
  const data = (await response.json()) as { token?: unknown };
  if (typeof data.token !== "string" || !data.token) throw new Error("Dev token missing");
  return data.token;
}

function selected(id: string): string {
  const node = document.querySelector(`#${id}`);
  return node instanceof HTMLSelectElement ? node.value : "";
}

function mount(): MountedAssistant {
  const locale = selected("locale");
  const display = selected("display") || "words";
  const corner = selected("corner") || "bottom-right";
  document.documentElement.lang = locale || "en";
  return mountAiAssistant(document.body, {
    token: session.token,
    apiBaseUrl: session.apiBaseUrl,
    preset: "ask",
    display,
    corner,
    primaryColor: "#1d4ed8",
    brandName: "Northline Supply",
    locale: locale || undefined,
  });
}

let current: MountedAssistant | null = null;

async function start(): Promise<void> {
  if (live) {
    try {
      session = { token: await fetchDevToken(), apiBaseUrl: LIVE_API_BASE };
    } catch (error) {
      // Fall back to the in-browser preview so the page still renders.
      console.error("Live mode unavailable, using the preview adapter.", error);
    }
  }
  current = mount();
}

function remount(): void {
  if (!current) return;
  current.unmount();
  current = mount();
}

for (const id of ["locale", "display", "corner"]) {
  document.getElementById(id)?.addEventListener("change", remount);
}

void start();
