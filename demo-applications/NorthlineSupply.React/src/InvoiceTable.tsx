import { Link } from "react-router-dom";
import type { Invoice } from "./api";
import { formatDate, formatMoney } from "./format";

export function InvoiceTable({ invoices }: { invoices: Invoice[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Invoice</th>
            <th scope="col">Order</th>
            <th scope="col">Billed</th>
            <th scope="col">Status</th>
            <th scope="col" className="num">
              Total
            </th>
            <th scope="col" className="num">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => (
            <tr key={invoice.invoiceNumber}>
              <th scope="row">{invoice.invoiceNumber}</th>
              <td>
                <Link to={`/orders/${encodeURIComponent(invoice.orderNumber)}`}>{invoice.orderNumber}</Link>
              </td>
              <td>{formatDate(invoice.billedOn)}</td>
              <td>{invoice.status}</td>
              <td className="num">{formatMoney(invoice.total)}</td>
              <td className="num">{formatMoney(invoice.balance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
