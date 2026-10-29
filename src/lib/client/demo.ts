/**
 * The demo's state in this browser: one reducer (src/lib/demo/store.ts),
 * saved to localStorage so a refresh keeps the queue and decisions. Storage
 * can be missing or full (private windows, blocked site data), so it falls
 * back to memory and the demo still works for the session.
 */
import { use, useSyncExternalStore } from "react";
import { browser } from "react-dom";
import { DEMO_VERSION, seed } from "../demo/seed";
import { reduce, type DemoAction } from "../demo/store";
import type { DemoState } from "../demo/types";
import { tick } from "./now";

const KEY = `label-check-demo-v${DEMO_VERSION}`;

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as DemoState;
      if (saved?.version === DEMO_VERSION && Array.isArray(saved.events)) return saved;
    }
  } catch {
    // Unreadable or blocked: start fresh.
  }
  return seed(Date.now());
}

let saving: ReturnType<typeof setTimeout> | undefined;

function write() {
  clearTimeout(saving);
  saving = undefined;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Full or blocked: keep going in memory.
  }
}

/**
 * Written behind, at most twice a second: during an importer's batch the
 * state changes several times a second, and each save is a few hundred KB.
 * Leaving the page writes whatever is pending.
 */
function save() {
  saving ??= setTimeout(write, 500);
}
if (typeof window !== "undefined") window.addEventListener("pagehide", () => saving && write());

/** Older demo versions' saved state, which this version can't read. */
function dropOldVersions() {
  try {
    for (let v = 1; v < DEMO_VERSION; v++) localStorage.removeItem(`label-check-demo-v${v}`);
  } catch {
    // Nothing to tidy.
  }
}

const emit = () => listeners.forEach((l) => l());

function getState(): DemoState {
  if (!state) {
    dropOldVersions();
    state = load();
  }
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the demo: pick it up here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    state = load();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function dispatch(action: DemoAction) {
  const next = reduce(getState(), action, Date.now());
  if (next === state) return;
  state = next;
  save();
  tick();
  emit();
}

/** The state right now, for reading what an action just did. */
export const currentDemo = () => getState();

/** Back to the starting demo, keeping whoever is signed in so they stay on the page. */
export function resetDemo() {
  const before = getState();
  const fresh = seed(Date.now());
  const stay = fresh.users.find((u) => u.id === before.currentUser);
  state = {
    ...fresh,
    currentUser: stay ? stay.id : fresh.currentUser,
    bannerDismissed: before.bannerDismissed,
  };
  save();
  emit();
}

/**
 * The demo state, rendered only in the browser: the server can't know who
 * is signed in here, so components using this suspend while prerendering
 * and show their Suspense fallback instead of a wrong guess.
 */
export function useDemo(): DemoState {
  use(browser("The demo's sign-in and queue are kept in this browser."));
  return useSyncExternalStore(subscribe, getState, getState);
}
