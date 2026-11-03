import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { useApi } from "../api-context";
import { formatCount, formatDate, formatMoney, formatPlain, orderSummary } from "../format";
import { ResourceBody, useApiResource } from "../useApiResource";

export function OrderPage() {
  const api = useApi();
  const { orderNumber = "" } = useParams();
  const load = useCallback(
    (signal: AbortSignal) => api.getOrder(orderNumber, signal),
    [api, orderNumber],
  );
  const state = useApiResource(load);
  const summary = state.status === "ready" ? orderSummary(state.data) : null;

  return (
    <>
      <h1>
        Order {state.status === "ready" ? state.data.orderNumber : orderNumber}
        <span className="source">Orders API</span>
      </h1>
      {state.status === "loading" || state.status === "error" ? <ResourceBody state={state}>{() => null}</ResourceBody> : null}
      {state.status === "ready" ? (
        <>
          {summary ? <p>{summary}</p> : null}
          <dl>
            <dt>Status</dt>
            <dd>{formatPlain(state.data.status)}</dd>
            <dt>Shipped</dt>
            <dd>{state.data.shippedOn ? formatDate(state.data.shippedOn) : ""}</dd>
            <dt>Open lines</dt>
            <dd>
              {formatCount(state.data.openLineCount)} of {formatCount(state.data.lineCount)}
            </dd>
          </dl>
          <section>
            <h2>Lines</h2>
            <p>
              Price and stock
              <span className="source">Inventory API</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col">Name</th>
                    <th scope="col" className="num">
                      Quantity
                    </th>
                    <th scope="col">Line status</th>
                    <th scope="col">Promise date</th>
                    <th scope="col" className="num">
                      Unit price
                    </th>
                    <th scope="col" className="num">
                      Available
                    </th>
                    <th scope="col" className="num">
                      Allocated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.lines.map((line, index) => (
                    <tr key={`${line.sku}-${index}`}>
                      <th scope="row">{formatPlain(line.sku)}</th>
                      <td>{formatPlain(line.name)}</td>
                      <td className="num">{formatCount(line.quantity)}</td>
                      <td>{formatPlain(line.status)}</td>
                      <td>{line.promiseDate ? formatDate(line.promiseDate) : ""}</td>
                      <td className="num">{formatMoney(line.unitPrice)}</td>
                      <td className="num">{formatCount(line.available)}</td>
                      <td className="num">{formatCount(line.allocated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
