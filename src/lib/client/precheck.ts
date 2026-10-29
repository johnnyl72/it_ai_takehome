/**
 * Checks queued applications in the background, so the result is usually
 * waiting by the time an agent opens one. Runs as many at once as there are
 * text readers; an application being opened jumps the line. Results stay in
 * memory only, since they hold the label's text.
 */
import { useSyncExternalStore } from "react";
import { kitEntry } from "../demo/seed";
import type { DemoApplication, Precheck } from "../demo/types";
import { TEST_KIT_DIR } from "../samples";
import type { VerificationResult } from "../types";
import { checkLabel, CheckError } from "./api";
import { dispatch } from "./demo";
import { readerCount } from "./ocr";

export type PrecheckState =
  | { state: "waiting" }
  | { state: "checking" }
  | { state: "done"; result: VerificationResult }
  | { state: "error"; message: string; retry: boolean };

let results = new Map<string, PrecheckState>();
const listeners = new Set<() => void>();
const line: DemoApplication[] = [];
let running = 0;

function set(id: string, value: PrecheckState) {
  results = new Map(results).set(id, value);
  listeners.forEach((l) => l());
}

/** Stores a result checked elsewhere (the automatic checks), so it isn't read again. */
export function primePrecheck(id: string, value: PrecheckState) {
  set(id, value);
}

/** Queues a check unless one is done or under way; `urgent` puts it at the front. */
export function requestPrecheck(app: DemoApplication, urgent = false) {
  const now = results.get(app.id);
  if (now && !(now.state === "error" && now.retry)) {
    if (urgent && now.state === "waiting") {
      const i = line.findIndex((a) => a.id === app.id);
      if (i > 0) line.unshift(...line.splice(i, 1));
    }
    return;
  }
  set(app.id, { state: "waiting" });
  if (urgent) line.unshift(app);
  else line.push(app);
  pump();
}

function pump() {
  while (running < readerCount() && line.length) void run(line.shift()!);
}

async function run(app: DemoApplication) {
  running++;
  set(app.id, { state: "checking" });
  const started = performance.now();
  try {
    const entry = kitEntry(app.kitFile);
    if (!entry) throw new CheckError("This application's label image is missing.", false);
    const res = await fetch(`${TEST_KIT_DIR}/labels/${app.kitFile}`);
    if (!res.ok) throw new CheckError("The label image couldn't be loaded. Check your connection.");
    const file = new File([await res.blob()], app.kitFile, { type: "image/jpeg" });
    const result = await checkLabel(file, entry.sample.application);
    set(app.id, { state: "done", result });
    dispatch({ type: "checked", appId: app.id, ms: result.timing.totalMs, outcome: result.verdict });
  } catch (e) {
    const retry = !(e instanceof CheckError) || e.retry;
    const message = e instanceof Error ? e.message : "The label couldn't be checked.";
    set(app.id, { state: "error", message, retry });
    dispatch({
      type: "checked",
      appId: app.id,
      ms: Math.round(performance.now() - started),
      outcome: retry ? "error" : "unreadable",
    });
  } finally {
    running--;
    pump();
  }
}

/** What the tool's check said, in the form a decision records. */
export function precheckOf(p: PrecheckState | undefined): Precheck | null {
  if (p?.state === "done") return p.result.verdict;
  if (p?.state === "error" && !p.retry) return "unreadable";
  return null;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePrechecks(): Map<string, PrecheckState> {
  return useSyncExternalStore(
    subscribe,
    () => results,
    () => results,
  );
}
