"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "shilpikala:urlparam";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * A query-string value (like `?q=lotus`) as React state. The value lives in the address bar, so a
 * refresh or the browser's back button restores it, but changing it only rewrites the current history
 * entry: no navigation, no server request and no page reload. Server render and first client render
 * both see "" so the static HTML never depends on the URL.
 */
export function useUrlParam(name: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name) ?? "",
    () => "",
  );
  const set = useCallback(
    (next: string) => {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set(name, next);
      else url.searchParams.delete(name);
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
      window.dispatchEvent(new Event(EVENT));
    },
    [name],
  );
  return [value, set];
}
