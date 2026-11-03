import { useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import type { Account } from "../api";
import { useApi } from "../api-context";
import { useSignedInAssistant } from "../assistant";
import { customerLine } from "../format";
import { clearSessionToken, readSessionToken } from "../session";

export function SignedInLayout() {
  if (!readSessionToken()) return <Navigate to="/login" replace />;
  return <SignedInShell />;
}

function SignedInShell() {
  const api = useApi();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  useSignedInAssistant();

  useEffect(() => {
    const controller = new AbortController();
    api.getAccount(controller.signal).then(
      (next) => {
        if (!controller.signal.aborted) setAccount(next);
      },
      () => {
        // The open page reports the API error. The header omits the identity line.
      },
    );
    return () => controller.abort();
  }, [api]);

  const line = account ? customerLine(account) : "";

  function signOut() {
    clearSessionToken();
    navigate("/login", { replace: true });
  }

  return (
    <div className="wrap">
      <header className="site">
        <p className="brand">Northline Supply</p>
        <nav aria-label="Primary">
          <NavLink className="nav-link" to="/account">
            Account
          </NavLink>
          <NavLink className="nav-link" to="/invoices">
            Invoices
          </NavLink>
          <NavLink className="nav-link" to="/catalog">
            Catalog
          </NavLink>
        </nav>
        <button type="button" className="sign-out" onClick={signOut}>
          Sign out
        </button>
        {line ? <p className="identity">{line}</p> : null}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
