import { useSyncExternalStore } from "react";

// [ASSUMED] Narrow layout starts at 479 px.
export const NARROW_QUERY = "(max-width: 479px)";
export const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(query: string, onChange: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function matches(query: string): boolean {
  return window.matchMedia(query).matches;
}

const subscribeNarrow = (onChange: () => void) => subscribe(NARROW_QUERY, onChange);
const subscribeReduce = (onChange: () => void) => subscribe(REDUCE_MOTION_QUERY, onChange);
const getNarrow = () => matches(NARROW_QUERY);
const getReduce = () => matches(REDUCE_MOTION_QUERY);
const getServerFalse = () => false;

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, getNarrow, getServerFalse);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduce, getReduce, getServerFalse);
}
