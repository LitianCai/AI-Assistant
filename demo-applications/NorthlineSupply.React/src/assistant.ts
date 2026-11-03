import { useEffect } from "react";
import { WIDGET_MOUNT_CONFIG } from "./widget-config";

interface MountedWidget {
  unmount(): void;
}

interface AssistantGlobal {
  mountAiAssistant(target: HTMLElement, config: typeof WIDGET_MOUNT_CONFIG): MountedWidget;
}

declare global {
  interface Window {
    AiAssistant?: AssistantGlobal;
  }
}

const SCRIPT_SRC = "/assistant/ai-assistant.umd.js";
let scriptPromise: Promise<void> | null = null;

// [ASSUMED] The built widget reads process.env.NODE_ENV. The portal defines it before the script runs.
function ensureWidgetProcess(): void {
  const host = window as Window & { process?: { env?: { NODE_ENV?: string } } };
  if (!host.process) host.process = { env: { NODE_ENV: "production" } };
  if (!host.process.env) host.process.env = { NODE_ENV: "production" };
  if (!host.process.env.NODE_ENV) host.process.env.NODE_ENV = "production";
}

function loadAssistantScript(): Promise<void> {
  ensureWidgetProcess();
  if (window.AiAssistant?.mountAiAssistant) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.dataset.northlineAssistant = "true";
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("Assistant script failed to load."));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export function useSignedInAssistant(): void {
  useEffect(() => {
    let alive = true;
    let mounted: MountedWidget | null = null;

    loadAssistantScript()
      .then(() => {
        if (!alive) return;
        const mount = window.AiAssistant?.mountAiAssistant;
        if (!mount) return;
        mounted = mount(document.body, WIDGET_MOUNT_CONFIG);
      })
      .catch(() => {
        // The portal still shows distributor records if the widget file is missing.
      });

    return () => {
      alive = false;
      mounted?.unmount();
    };
  }, []);
}
