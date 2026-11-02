import type { Lang } from "./types";

/** Browser result event, narrowed to the fields this widget reads. */
export interface RecognitionAlternativeLike {
  transcript?: string;
}

export interface RecognitionResultLike {
  isFinal: boolean;
  readonly [index: number]: RecognitionAlternativeLike | undefined;
}

export interface RecognitionEventLike {
  resultIndex?: number;
  results: ArrayLike<RecognitionResultLike>;
}

/** The subset of the browser SpeechRecognition object this widget uses. */
export interface SpeechEngine {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechEngineCtor = new () => SpeechEngine;

export interface DictationHandlers {
  onTranscript: (transcript: string) => void;
  onEnd: () => void;
}

export interface DictationSession {
  readonly active: boolean;
  stop(): void;
}

// [ASSUMED] A final transcript is appended after one space; interim results are ignored.
export function insertTranscript(draft: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return draft;
  if (!draft.trim()) return spoken;
  return `${draft.replace(/\s+$/, "")} ${spoken}`;
}

/** Final phrases from resultIndex forward. Interim hypotheses are dropped. */
export function finalTranscript(event: RecognitionEventLike): string {
  const start = event.resultIndex ?? 0;
  const parts: string[] = [];
  for (let index = start; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (!result?.isFinal) continue;
    const spoken = result[0]?.transcript?.trim() ?? "";
    if (spoken) parts.push(spoken);
  }
  return parts.join(" ");
}

/**
 * The browser's built-in engine only. No server speech API is consulted.
 * Returns null when this browser cannot recognize speech.
 */
export function browserSpeechRecognition(): SpeechEngineCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: SpeechEngineCtor;
    webkitSpeechRecognition?: SpeechEngineCtor;
  };
  const ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return typeof ctor === "function" ? ctor : null;
}

// [ASSUMED] Recognition ends after one utterance (continuous is false).
export function startDictation(
  Ctor: SpeechEngineCtor,
  locale: Lang,
  handlers: DictationHandlers,
): DictationSession | null {
  let recognition: SpeechEngine;
  try {
    recognition = new Ctor();
  } catch {
    return null;
  }
  recognition.lang = locale;
  recognition.continuous = false;
  recognition.interimResults = false;

  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    handlers.onEnd();
  };

  recognition.onresult = (event) => {
    if (closed) return;
    const spoken = finalTranscript(event);
    if (!spoken) return;
    handlers.onTranscript(spoken);
  };
  recognition.onerror = () => {
    finish();
  };
  recognition.onend = () => {
    finish();
  };

  try {
    recognition.start();
  } catch {
    closed = true;
    return null;
  }

  return {
    get active() {
      return !closed;
    },
    stop() {
      if (closed) return;
      closed = true;
      try {
        recognition.abort();
      } catch {
        // The browser had already ended the session.
      }
    },
  };
}
