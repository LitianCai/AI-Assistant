import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api-context";

export function LoginPage() {
  const api = useApi();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = userName.trim();
    if (!name) {
      setError("Enter a user name.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      await api.login(name);
      navigate("/account", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "The API is unreachable.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="wrap">
      <header className="site">
        <p className="brand">Northline Supply</p>
      </header>
      <main>
        <h1>Sign in</h1>
        <form onSubmit={onSubmit} aria-busy={pending}>
          <div className="field">
            <label htmlFor="user-name">User name</label>
            <input
              id="user-name"
              name="userName"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="riley.chen"
              value={userName}
              onChange={(event) => setUserName(event.target.value)}
              aria-invalid={error ? true : undefined}
              required
            />
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}
