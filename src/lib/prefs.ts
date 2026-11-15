"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed preference store usable with useSyncExternalStore,
 * so client preferences (language, theme) hydrate without effects or flashes of wrong state.
 */
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function readPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePref<T extends string>(key: string, fallback: T, valid?: readonly T[]): [T, (v: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const v = readPref(key) as T | null;
      return v && (!valid || valid.includes(v)) ? v : fallback;
    },
    () => fallback,
  );
  const set = useCallback((v: T) => writePref(key, v), [key]);
  return [value, set];
}
