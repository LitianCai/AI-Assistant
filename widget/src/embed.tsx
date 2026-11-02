import { createRoot, type Root } from "react-dom/client";
import { createAssistantApi } from "./api";
import { Assistant } from "./Assistant";
import { normalizeConfig } from "./config";
import { resolveLocale } from "./locale";
import type { AiAssistantConfig, MountedAssistant } from "./types";

export type { AiAssistantConfig, MountedAssistant } from "./types";

/**
 * Mount the assistant in a shadow root so host CSS does not style it.
 *
 * mountAiAssistant(target, {
 *   token,            // Authorization: Bearer only. No tenant, company, or user id.
 *   apiBaseUrl?,      // omit or "preview" for the in-browser preview adapter
 *   preset?,          // ask | help | question | chat | info (default ask)
 *   display?,         // words | icon (default words)
 *   corner?,          // bottom-right | bottom-left | top-right | top-left
 *   primaryColor?,    // #rrggbb; white text must meet WCAG AA 4.5:1, else #1d4ed8
 *   brandName?,       // plain text, tags stripped, 40 characters max
 *   locale?           // host locale, then page lang, then browser language, then English
 * })
 */
export function mountAiAssistant(target?: HTMLElement | null, config?: AiAssistantConfig): MountedAssistant {
  const parent = target ?? document.body;
  const normalized = normalizeConfig(config);
  const locale = resolveLocale({
    hostLocale: normalized.locale,
    documentLang: document.documentElement.lang,
    navigatorLang: navigator.language,
  });
  const api = createAssistantApi({
    token: normalized.token,
    apiBaseUrl: normalized.apiBaseUrl,
    locale,
  });

  const host = document.createElement("div");
  host.setAttribute("data-ai-assistant", "");
  const locked = [
    ["position", "fixed"],
    ["left", "0"],
    ["top", "0"],
    ["width", "0"],
    ["height", "0"],
    ["overflow", "visible"],
    ["margin", "0"],
    ["border", "0"],
    ["padding", "0"],
    ["background", "transparent"],
    ["pointer-events", "none"],
    ["z-index", "2147483000"],
  ] as const;
  for (const [property, value] of locked) host.style.setProperty(property, value, "important");

  const shadow = host.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  mountPoint.style.pointerEvents = "none";
  shadow.appendChild(mountPoint);
  parent.appendChild(host);

  const root: Root = createRoot(mountPoint);
  root.render(<Assistant config={normalized} api={api} locale={locale} />);

  return {
    unmount() {
      root.unmount();
      host.remove();
    },
  };
}
