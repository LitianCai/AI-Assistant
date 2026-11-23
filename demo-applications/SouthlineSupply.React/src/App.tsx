import { useMemo } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { createApiClient } from "./api";
import { ApiProvider } from "./api-context";
import { readSessionToken, writeSessionToken } from "./session";
import { AccountPage } from "./pages/AccountPage";
import { CatalogPage } from "./pages/CatalogPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { LoginPage } from "./pages/LoginPage";
import { OrderPage } from "./pages/OrderPage";
import { SignedInLayout } from "./pages/SignedInLayout";

export function App() {
  const api = useMemo(
    () =>
      createApiClient({
        // [ASSUMED] Southline API is on port 5090 so it does not share 5080 with NorthlineSupply.Api.
        baseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:5090",
        getToken: readSessionToken,
        setToken: writeSessionToken,
      }),
    [],
  );

  return (
    <ApiProvider api={api}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<SignedInLayout />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/orders/:orderNumber" element={<OrderPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="*" element={<Navigate to="/account" replace />} />
        </Route>
      </Routes>
    </ApiProvider>
  );
}
