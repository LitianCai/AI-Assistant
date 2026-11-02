/**
 * Greeting visibility.
 * Session flag: at most once per browser visit.
 * Opened flag (localStorage): never again after the panel is opened.
 * Day flag (localStorage): if they never open it, at most once on a later calendar day.
 * No message text is stored.
 */

const SESSION_KEY = "nlw:greet-session";
const OPENED_KEY = "nlw:opened";
const DAY_KEY = "nlw:greet-day";

export interface GreetingFlags {
  reduceMotion: boolean;
  opened: boolean;
  shownThisSession: boolean;
  lastShownDay: string | null;
  today: string;
}

export function localDay(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function canShowGreeting(flags: GreetingFlags): boolean {
  if (flags.reduceMotion) return false;
  if (flags.opened) return false;
  if (flags.shownThisSession) return false;
  if (flags.lastShownDay === flags.today) return false;
  return true;
}

function read(store: Storage | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(store: Storage | undefined, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* Storage may be blocked. The in-memory page still behaves. */
  }
}

export function readGreetingFlags(reduceMotion: boolean, today = localDay()): GreetingFlags {
  const session = typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  const local = typeof localStorage === "undefined" ? undefined : localStorage;
  return {
    reduceMotion,
    opened: read(local, OPENED_KEY) === "1",
    shownThisSession: read(session, SESSION_KEY) === "1",
    lastShownDay: read(local, DAY_KEY),
    today,
  };
}

/** Retention: this browser tab session only. */
export function rememberGreetingShown(today = localDay()): void {
  const session = typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  const local = typeof localStorage === "undefined" ? undefined : localStorage;
  write(session, SESSION_KEY, "1");
  write(local, DAY_KEY, today);
}

/** Retention: kept so a later visit does not show the greeting again. */
export function rememberOpened(): void {
  const local = typeof localStorage === "undefined" ? undefined : localStorage;
  write(local, OPENED_KEY, "1");
}
