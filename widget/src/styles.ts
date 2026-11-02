export const WIDGET_CSS = `
.root, .root * { box-sizing: border-box; }
.root {
  --primary: #1d4ed8;
  --on-primary: #ffffff;
  --text: #1c2430;
  --muted: #3e4a5c;
  --faint: #5c6b80;
  --line: #d5dce6;
  --surface: #ffffff;
  --stage: #f4f6f9;
  --user: #e7eefc;
  --assistant: #f3f5f8;
  --radius: 8px;
  color: var(--text);
  /* [ASSUMED] Font fallbacks after Segoe UI are system-ui, sans-serif. */
  font-family: "Segoe UI", system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.45;
  pointer-events: none;
  color-scheme: light;
}
.root button, .root input { font-family: inherit; }
.cluster, .panel { pointer-events: auto; }

.cluster {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 32px);
  /* [ASSUMED] Launcher cluster z-index is 1. */
  z-index: 1;
}
.cluster.bottom-right { right: 16px; bottom: 16px; flex-direction: row; }
.cluster.bottom-left { left: 16px; bottom: 16px; flex-direction: row-reverse; }
.cluster.top-right { right: 16px; top: 16px; flex-direction: row; }
.cluster.top-left { left: 16px; top: 16px; flex-direction: row-reverse; }

.launcher {
  position: relative;
  height: 44px;
  min-height: 44px;
  min-width: 44px;
  width: max-content;
  max-width: none;
  flex: 0 0 auto;
  padding: 0 14px;
  border: 0;
  border-radius: var(--radius);
  background: var(--primary);
  color: var(--on-primary);
  font-size: 14px;
  font-weight: 650;
  line-height: 44px;
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  cursor: pointer;
}
.launcher.circle {
  width: 44px;
  min-width: 44px;
  max-width: 44px;
  padding: 0;
  border-radius: 999px;
  line-height: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.greet {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 8px 18px rgba(20, 32, 51, 0.1);
  padding: 0 0 0 12px;
}
.greet.arrive { animation: nlw-greet-in 420ms ease-out 1 both; }
.greet-text {
  margin: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.3;
  text-align: start;
  padding: 8px 0;
  white-space: nowrap;
  cursor: pointer;
}
.greet-dismiss {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  padding: 0;
  cursor: pointer;
}

@keyframes nlw-greet-in {
  from { opacity: 0; transform: translateX(8px); }
  to { opacity: 1; transform: none; }
}

.panel {
  position: fixed;
  width: 360px;
  max-width: calc(100vw - 32px);
  max-height: min(640px, calc(100dvh - 32px));
  display: flex;
  flex-direction: column;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: 0 10px 28px rgba(20, 32, 51, 0.12);
  overflow: hidden;
  font-size: 14px;
  line-height: 1.45;
  /* [ASSUMED] Open panel z-index is 2. */
  z-index: 2;
}
.panel.bottom-right { right: 16px; bottom: 16px; }
.panel.bottom-left { left: 16px; bottom: 16px; }
.panel.top-right { right: 16px; top: 16px; }
.panel.top-left { left: 16px; top: 16px; }

.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--line);
}
.logo {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--primary);
  color: var(--on-primary);
}
.name {
  min-width: 0;
  flex: 1;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.minimize {
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  flex: 0 0 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  padding: 0;
  cursor: pointer;
}

.thread {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  min-height: 0;
  max-height: min(420px, calc(100dvh - 220px));
}
.msg {
  max-width: 92%;
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--radius);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.msg p { margin: 0; }
.msg.user { align-self: flex-end; background: var(--user); }
.msg.bot { align-self: flex-start; background: var(--assistant); }
.source {
  margin: 6px 0 0;
  color: var(--faint);
  font-size: 12px;
}
.status {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}
.spinner {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: nlw-spin 0.8s linear infinite;
}
@keyframes nlw-spin {
  to { transform: rotate(360deg); }
}

.suggested {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 10px;
}
.panel-head + .suggested { padding-top: 12px; }
.suggested button {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  line-height: 1.2;
  padding: 0 10px;
  min-height: 44px;
  white-space: nowrap;
  cursor: pointer;
}

.composer {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0 12px 10px;
  padding: 4px 4px 4px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
}
.composer input {
  flex: 1;
  min-width: 0;
  border: 0;
  padding: 8px 0;
  background: transparent;
  color: var(--text);
  font-size: 14px;
}
.composer input:focus { outline: none; }
.composer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  min-width: 44px;
  min-height: 44px;
  border: 0;
  border-radius: 6px;
  background: var(--primary);
  color: var(--on-primary);
  padding: 0;
  cursor: pointer;
}
.composer button[aria-disabled="true"] {
  background: var(--stage);
  color: var(--faint);
  cursor: default;
}
.composer button.dictate {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--line);
}
.composer button.dictate[aria-pressed="true"] {
  background: var(--primary);
  color: var(--on-primary);
  border-color: transparent;
}
.composer button.dictate[aria-pressed="true"] .mic-icon {
  animation: nlw-mic-pulse 1.2s ease-in-out infinite;
}
@keyframes nlw-mic-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}
.send-icon, .mic-icon { display: inline-flex; pointer-events: none; }
.send-icon svg, .mic-icon { display: block; }

.launcher:focus-visible,
.greet-text:focus-visible,
.greet-dismiss:focus-visible,
.minimize:focus-visible,
.suggested button:focus-visible,
.composer button:focus-visible,
.composer input:focus-visible {
  outline: 2px solid #1c2430;
  outline-offset: 2px;
}

/* [ASSUMED] Narrow layout starts at 479 px. */
@media (max-width: 479px) {
  .greet { min-width: 0; }
  .greet-text { white-space: normal; }
  .panel.bottom-right,
  .panel.bottom-left,
  .panel.top-right,
  .panel.top-left {
    left: 0;
    right: 0;
    width: 100%;
    max-width: none;
    border-radius: 8px;
    max-height: 100dvh;
  }
  .panel.bottom-right, .panel.bottom-left { bottom: 0; top: auto; }
  .panel.top-right, .panel.top-left { top: 0; bottom: auto; }
  .thread { max-height: calc(100dvh - 220px); }
}

@media (prefers-reduced-motion: reduce) {
  .greet.arrive { animation: none; }
  .greet { display: none; }
  .spinner { animation: none; display: none; }
  .composer button.dictate[aria-pressed="true"] .mic-icon { animation: none; }
}
`;
