import { useEffect, useState, type ReactNode } from "react";

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export function useApiResource<T>(load: (signal: AbortSignal) => Promise<T>): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error && error.message ? error.message : "The API is unreachable.";
        setState({ status: "error", message });
      },
    );
    return () => controller.abort();
  }, [load]);

  return state;
}

export function ResourceBody<T>({
  state,
  children,
}: {
  state: LoadState<T>;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading") return <p aria-live="polite">Loading…</p>;
  if (state.status === "error") return <p role="alert">{state.message}</p>;
  return children(state.data);
}
