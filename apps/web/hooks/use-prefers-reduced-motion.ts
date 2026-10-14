"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

// Optional: a browser (or jsdom) without matchMedia reads as no preference.
function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);

  media?.addEventListener("change", onChange);

  return () => media?.removeEventListener("change", onChange);
}

/**
 * Whether the reader prefers reduced motion. The server cannot know, so the
 * browser's first render answers as the server did, and React renders again
 * with the reader's answer once the page has hydrated. Motion's own
 * `useReducedMotion` answers in that first render, so anything shaped by it
 * drew different markup than the server sent (React error 418).
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false
  );
}
