// [ASSUMED] The distributor session token is kept in sessionStorage under this key.
// Retention is the browser session. Sign-out removes it. It is not the widget token.
export const SESSION_TOKEN_KEY = "northline.demo.token";

export function readSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  try {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    // The next navigation treats a missing token as signed out.
  }
}
