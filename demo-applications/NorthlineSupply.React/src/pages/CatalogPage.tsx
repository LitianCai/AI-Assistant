import { useCallback, useState, type FormEvent } from "react";
import { useApi } from "../api-context";
import { formatCount, formatMoney, formatPlain, substituteLabels } from "../format";
import { ResourceBody, useApiResource } from "../useApiResource";

export function CatalogPage() {
  const api = useApi();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback((signal: AbortSignal) => api.searchCatalog(query, signal), [api, query]);
  const state = useApiResource(load);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft.trim());
  }

  return (
    <>
      <h1>
        Catalog
        <span className="source">Inventory API</span>
      </h1>
      <form className="search" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="catalog-search">Search</label>
          <input
            id="catalog-search"
            name="q"
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <button type="submit">Search</button>
      </form>
      <ResourceBody state={state}>
        {(items) =>
          items.length === 0 ? (
            <p>No catalog items.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col">Name</th>
                    <th scope="col">Material</th>
                    <th scope="col">Size</th>
                    <th scope="col">Pressure</th>
                    <th scope="col" className="num">
                      Customer price
                    </th>
                    <th scope="col" className="num">
                      Available
                    </th>
                    <th scope="col" className="num">
                      Allocated
                    </th>
                    <th scope="col">Substitutes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const substitutes = substituteLabels(item.substitutes);
                    return (
                      <tr key={`${item.sku}-${index}`}>
                        <th scope="row">{formatPlain(item.sku)}</th>
                        <td>{formatPlain(item.name)}</td>
                        <td>{formatPlain(item.material)}</td>
                        <td>{formatPlain(item.size)}</td>
                        <td>{formatPlain(item.pressure)}</td>
                        <td className="num">{formatMoney(item.unitPrice)}</td>
                        <td className="num">{formatCount(item.available)}</td>
                        <td className="num">{formatCount(item.allocated)}</td>
                        <td>{substitutes.length > 0 ? substitutes.join(", ") : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </ResourceBody>
    </>
  );
}
