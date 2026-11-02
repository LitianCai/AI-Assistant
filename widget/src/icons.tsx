import type { ReactElement } from "react";

/**
 * Static send glyphs owned by this package, never by host config.
 * The wide-panel icon is Heroicons v2 outline paper-airplane (MIT).
 * https://github.com/tailwindlabs/heroicons
 */
const PAPER_AIRPLANE = `<!-- Heroicons v2 outline paper-airplane, MIT License, https://github.com/tailwindlabs/heroicons -->
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/></svg>`;

const THIN_ARROW = `<!-- Original thin arrow for the narrow full-width panel. -->
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 10h12M11.5 5.5 16 10 11.5 14.5"/></svg>`;

export function SendIcon({ narrow }: { narrow: boolean }): ReactElement {
  return (
    <span
      className="send-icon"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: narrow ? THIN_ARROW : PAPER_AIRPLANE }}
    />
  );
}

export function ChatBubbleIcon(): ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M6 7.25h12A1.75 1.75 0 0 1 19.75 9v6.25A1.75 1.75 0 0 1 18 17H10l-3.75 2.75V17H6A1.75 1.75 0 0 1 4.25 15.25V9A1.75 1.75 0 0 1 6 7.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LogoMark(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M3.5 13V3.5L12.5 13V3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MinimizeIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function MicIcon(): ReactElement {
  return (
    <svg className="mic-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="9" y="3.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 11.5a5 5 0 0 0 10 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 16.5V20M9 20h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function DismissIcon(): ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
