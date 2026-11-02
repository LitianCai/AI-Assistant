import { mountAiAssistant, type MountedAssistant } from "./embed";

const DEMO_TOKEN = "preview-demo-token";

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
    token: DEMO_TOKEN,
    apiBaseUrl: "preview",
    preset: "ask",
    display,
    corner,
    primaryColor: "#1d4ed8",
    brandName: "Northline Supply",
    locale: locale || undefined,
  });
}

let current = mount();

function remount(): void {
  current.unmount();
  current = mount();
}

for (const id of ["locale", "display", "corner"]) {
  document.getElementById(id)?.addEventListener("change", remount);
}
