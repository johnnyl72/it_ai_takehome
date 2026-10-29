/**
 * The current time as React state: render code can't call Date.now() and
 * stay pure. Ticks every 30 seconds while something shows it, and on every
 * demo change, so a decision just made is counted at once.
 */
import { useSyncExternalStore } from "react";

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

export function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  timer ??= setInterval(tick, 30_000);
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export const useNow = () =>
  useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
