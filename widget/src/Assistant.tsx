import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { isAbortError, messageForFailure } from "./api";
import type { NormalizedConfig } from "./config";
import { canShowGreeting, readGreetingFlags, rememberGreetingShown, rememberOpened } from "./greeting";
import { ChatBubbleIcon, DismissIcon, LogoMark, MicIcon, MinimizeIcon, SendIcon } from "./icons";
import { useNarrow, useReducedMotion } from "./media";
import {
  browserSpeechRecognition,
  insertTranscript,
  startDictation,
  type DictationSession,
  type SpeechEngineCtor,
} from "./speech";
import { WIDGET_CSS } from "./styles";
import { stringsFor } from "./strings";
import type { AssistantApi, ChatMessage, Lang } from "./types";

interface UiMessage extends ChatMessage {
  reveal?: boolean;
}

// [ASSUMED] The greeting bubble appears after 3000 ms.
const GREETING_DELAY_MS = 3000;

function AnswerText({ text, source }: { text: string; source: string | null }) {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  // [ASSUMED] Answers reveal 2 words every 160 ms.
  const [count, setCount] = useState(() => Math.min(2, words.length));

  useEffect(() => {
    if (count >= words.length) return;
    const timer = window.setTimeout(() => {
      setCount((current) => Math.min(words.length, current + 2));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [count, words.length]);

  const complete = count >= words.length;
  return (
    <>
      <p>{words.slice(0, count).join(" ")}</p>
      {complete && source ? <p className="source">{source}</p> : null}
    </>
  );
}

function MessageView({ message, reduceMotion }: { message: UiMessage; reduceMotion: boolean }) {
  if (message.role === "user") {
    return <p className="msg user">{message.text}</p>;
  }
  const showFull = !message.reveal || reduceMotion;
  return (
    <div className="msg bot">
      {showFull ? (
        <>
          <p>{message.text}</p>
          {message.source ? <p className="source">{message.source}</p> : null}
        </>
      ) : (
        <AnswerText text={message.text} source={message.source} />
      )}
    </div>
  );
}

export function Assistant({
  config,
  api,
  locale,
}: {
  config: NormalizedConfig;
  api: AssistantApi;
  locale: Lang;
}) {
  const copy = stringsFor(locale);
  const narrow = useNarrow();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef(false);
  const dirty = useRef(false);
  const sending = useRef(false);
  const opened = useRef(false);
  const liveRequest = useRef<AbortController | null>(null);
  const recognitionCtor = useRef<SpeechEngineCtor | null>(browserSpeechRecognition());
  const dictation = useRef<DictationSession | null>(null);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    api.getConversation(controller.signal).then(
      (conversation) => {
        if (!active || dirty.current) return;
        setMessages(conversation.messages);
      },
      (error: unknown) => {
        if (!active || dirty.current || isAbortError(error)) return;
        setMessages([{ role: "assistant", text: messageForFailure(error, locale), source: null }]);
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [api, locale]);

  useEffect(() => () => liveRequest.current?.abort(), []);

  useEffect(() => {
    if (reduceMotion || opened.current) return;
    if (!canShowGreeting(readGreetingFlags(false))) return;
    const timer = window.setTimeout(() => {
      if (opened.current || !canShowGreeting(readGreetingFlags(false))) return;
      rememberGreetingShown();
      setShowGreeting(true);
    }, GREETING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      return;
    }
    if (pendingFocus.current) {
      pendingFocus.current = false;
      launcherRef.current?.focus();
    }
  }, [open]);

  function stopDictation() {
    const current = dictation.current;
    dictation.current = null;
    current?.stop();
    setListening(false);
  }

  useEffect(() => {
    if (open || !dictation.current) return;
    stopDictation();
  }, [open]);

  useEffect(() => {
    return () => {
      dictation.current?.stop();
      dictation.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      stopDictation();
      pendingFocus.current = true;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, working, open]);

  function openPanel() {
    opened.current = true;
    rememberOpened();
    setShowGreeting(false);
    setOpen(true);
  }

  function closePanel() {
    stopDictation();
    pendingFocus.current = true;
    setOpen(false);
  }

  function onDictate() {
    if (dictation.current) {
      stopDictation();
      return;
    }
    const Ctor = recognitionCtor.current;
    if (!Ctor) return;
    const session = startDictation(Ctor, locale, {
      onTranscript(transcript) {
        setDraft((current) => insertTranscript(current, transcript));
        // [ASSUMED] After a final transcript, focus returns to the message field.
        inputRef.current?.focus();
      },
      onEnd() {
        dictation.current = null;
        setListening(false);
      },
    });
    if (!session?.active) return;
    dictation.current = session;
    setListening(true);
  }

  async function send(text: string) {
    // [ASSUMED] Sending stops recognition so a late result is not written into the cleared field.
    stopDictation();
    const trimmed = text.trim();
    if (!trimmed || sending.current) return;
    sending.current = true;
    dirty.current = true;
    setDraft("");
    setWorking(true);
    setMessages((current) => [...current, { role: "user", text: trimmed, source: null }]);
    const controller = new AbortController();
    liveRequest.current = controller;
    try {
      const result = await api.sendMessage(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((current) => [
        ...current,
        { role: "assistant", text: result.text, source: result.source, reveal: true },
      ]);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return;
      setMessages((current) => [
        ...current,
        { role: "assistant", text: messageForFailure(error, locale), source: null, reveal: true },
      ]);
    } finally {
      if (liveRequest.current === controller) liveRequest.current = null;
      sending.current = false;
      setWorking(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (working) return;
    void send(draft);
  }

  const launcherWord = copy.launcher[config.preset];
  const iconOnly = config.display === "icon";
  // [ASSUMED] The microphone control is omitted when the browser has no speech recognition.
  const speechSupported = recognitionCtor.current !== null;
  const circle = iconOnly || config.preset === "question";
  const theme = { "--primary": config.primaryColor } as CSSProperties;
  const showThread = messages.length > 0 || working;

  return (
    <>
      <style>{WIDGET_CSS}</style>
      <div className="root" lang={locale} style={theme} data-narrow={narrow ? "true" : "false"}>
        {open ? (
          <section className={`panel ${config.corner}`} role="dialog" aria-modal="false" aria-label={config.brandName}>
            <header className="panel-head">
              <span className="logo" aria-hidden="true">
                <LogoMark />
              </span>
              <span className="name">{config.brandName}</span>
              <button type="button" className="minimize" aria-label={copy.minimize} title={copy.minimize} onClick={closePanel}>
                <MinimizeIcon />
              </button>
            </header>
            {showThread ? (
              <div className="thread" ref={threadRef}>
                {messages.map((message, index) => (
                  <MessageView key={`${index}-${message.role}`} message={message} reduceMotion={reduceMotion} />
                ))}
                {working ? (
                  <p className="status" aria-live="polite">
                    {reduceMotion ? null : <span className="spinner" aria-hidden="true" />}
                    {copy.working}
                  </p>
                ) : null}
              </div>
            ) : null}
            {working ? null : (
              <div className="suggested">
                {copy.suggestions.map((question) => (
                  <button key={question} type="button" onClick={() => void send(question)}>
                    {question}
                  </button>
                ))}
              </div>
            )}
            <form className="composer" onSubmit={onSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                placeholder={copy.placeholder}
                aria-label={copy.placeholder}
                autoComplete="off"
                autoCorrect="off"
                onChange={(event) => setDraft(event.target.value)}
              />
              {speechSupported ? (
                <button
                  type="button"
                  className="dictate"
                  aria-label={copy.dictate}
                  title={copy.dictate}
                  aria-pressed={listening}
                  onClick={onDictate}
                >
                  <MicIcon />
                </button>
              ) : null}
              <button type="submit" aria-label={copy.send} title={copy.send} aria-disabled={working ? true : undefined}>
                <SendIcon narrow={narrow} />
              </button>
            </form>
          </section>
        ) : (
          <div className={`cluster ${config.corner}`}>
            {showGreeting ? (
              <div className="greet arrive">
                <button type="button" className="greet-text" tabIndex={-1} onClick={openPanel}>
                  {copy.greeting}
                </button>
                <button
                  type="button"
                  className="greet-dismiss"
                  aria-label={copy.dismiss}
                  title={copy.dismiss}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setShowGreeting(false);
                  }}
                >
                  <DismissIcon />
                </button>
              </div>
            ) : null}
            <button
              ref={launcherRef}
              type="button"
              className={circle ? "launcher circle" : "launcher"}
              aria-expanded={false}
              onClick={openPanel}
              {...(iconOnly ? { "aria-label": launcherWord, title: launcherWord } : {})}
            >
              {iconOnly ? <ChatBubbleIcon /> : launcherWord}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
