import { useCallback } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../api-context";
import { creditSentence, formatDate, isOpenInvoice, orderSummary } from "../format";
import { InvoiceTable } from "../InvoiceTable";
import { ResourceBody, useApiResource } from "../useApiResource";

export function AccountPage() {
  const api = useApi();
  // [ASSUMED] Recent orders are shown in the order the API returns them.
  const load = useCallback(
    (signal: AbortSignal) =>
      Promise.all([api.getAccount(signal), api.getOrders(signal), api.getInvoices(signal)]).then(
        ([account, orders, invoices]) => ({
          account,
          orders,
          invoices: invoices.filter(isOpenInvoice),
        }),
      ),
    [api],
  );
  const state = useApiResource(load);

  return (
    <>
      <h1>Account</h1>
      <ResourceBody state={state}>
        {({ account, orders, invoices }) => (
          <>
            <dl>
              <dt>Buyer</dt>
              <dd>{account.buyerName}</dd>
              <dt>Account name</dt>
              <dd>{account.accountName}</dd>
              <dt>Account number</dt>
              <dd>{account.accountNumber}</dd>
            </dl>
            {typeof account.creditHold === "boolean" ? <p>{creditSentence(account.creditHold)}</p> : null}
            <section>
              <h2>
                Recent orders
                <span className="source">Orders API</span>
              </h2>
              {orders.length === 0 ? (
                <p>No orders.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Order</th>
                        <th scope="col">Placed</th>
                        <th scope="col">Status</th>
                        <th scope="col">Shipped</th>
                        <th scope="col">Open lines</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => {
                        const summary = orderSummary(order);
                        return (
                          <tr key={order.orderNumber}>
                            <th scope="row">
                              <Link to={`/orders/${encodeURIComponent(order.orderNumber)}`}>{order.orderNumber}</Link>
                              {summary ? <p className="summary">{summary}</p> : null}
                            </th>
                            <td>{formatDate(order.placedOn)}</td>
                            <td>{order.status}</td>
                            <td>{order.shippedOn ? formatDate(order.shippedOn) : ""}</td>
                            <td>
                              {order.openLineCount} of {order.lineCount}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h2>
                Open invoices
                <span className="source">Invoices API</span>
              </h2>
              {invoices.length === 0 ? <p>No open invoices.</p> : <InvoiceTable invoices={invoices} />}
            </section>
          </>
        )}
      </ResourceBody>
    </>
  );
}
