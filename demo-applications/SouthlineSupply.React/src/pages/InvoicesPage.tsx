import { useCallback } from "react";
import { useApi } from "../api-context";
import { InvoiceTable } from "../InvoiceTable";
import { ResourceBody, useApiResource } from "../useApiResource";

export function InvoicesPage() {
  const api = useApi();
  const load = useCallback((signal: AbortSignal) => api.getInvoices(signal), [api]);
  const state = useApiResource(load);

  return (
    <>
      <h1>
        Invoices
        <span className="source">Invoices API</span>
      </h1>
      <ResourceBody state={state}>
        {(invoices) => (invoices.length === 0 ? <p>No invoices.</p> : <InvoiceTable invoices={invoices} />)}
      </ResourceBody>
    </>
  );
}
