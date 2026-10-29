/**
 * The automatic checks, run in this tab as a stand-in for the server's
 * workers: new applications arrive every few seconds (faster while an
 * importer's batch is waiting), and each is really read and checked. A clean
 * match clears; anything else lands in an agent's queue with the reason.
 * Pauses while the tab is hidden, and leaves a reader free for the agent.
 */
import { useEffect } from "react";
import { issues } from "../demo/reasons";
import { QUEUE_KIT } from "../demo/seed";
import { nextArrivalId } from "../demo/store";
import { TEST_KIT_DIR, type KitEntry } from "../samples";
import { checkLabel, CheckError } from "./api";
import { currentDemo, dispatch } from "./demo";
import { readerCount } from "./ocr";
import { primePrecheck } from "./precheck";

/** One arrival this often when nothing is waiting: about 20 a minute. */
const TRICKLE_MS = 3000;

/** Most filings are fine, so clean labels arrive far more often than the problem ones. */
const ARRIVALS: KitEntry[] = QUEUE_KIT.flatMap((e) =>
  Array(e.expected === "Match" ? 12 : e.expected === "Review" ? 3 : e.expected === "Problem" ? 2 : 1).fill(e),
);

const images = new Map<string, Promise<Blob>>();
const imageFor = (file: string) => {
  let p = images.get(file);
  if (!p) {
    p = fetch(`${TEST_KIT_DIR}/labels/${file}`).then((r) => {
      if (!r.ok) throw new CheckError("The label image couldn't be loaded.");
      return r.blob();
    });
    p.catch(() => images.delete(file));
    images.set(file, p);
  }
  return p;
};

let busy = 0;
let fromBacklogBusy = 0;
let lastArrival = 0;

async function checkOne(fromBacklog: boolean) {
  busy++;
  if (fromBacklog) fromBacklogBusy++;
  lastArrival = Date.now();
  const entry = ARRIVALS[Math.floor(Math.random() * ARRIVALS.length)];
  const started = performance.now();
  // The id is taken when the result is recorded, since several run at once.
  const record = (a: {
    outcome: "pass" | "review" | "fail" | "unreadable" | "error";
    quality: "good" | "fair" | "poor" | null;
    why: string;
    ms: number;
  }) => {
    const appId = nextArrivalId(currentDemo());
    dispatch({ type: "auto-checked", appId, kitFile: entry.file, fromBacklog, ...a });
    return appId;
  };
  try {
    const file = new File([await imageFor(entry.file)], entry.file, { type: "image/jpeg" });
    const result = await checkLabel(file, entry.sample.application);
    const appId = record({
      outcome: result.verdict,
      quality: result.reading.imageQuality,
      why: issues(result)[0] ?? "",
      ms: result.timing.totalMs,
    });
    // Sent to a person: keep the full result, so opening it is instant.
    if (currentDemo().applications.some((a) => a.id === appId))
      primePrecheck(appId, { state: "done", result });
  } catch (e) {
    const retry = !(e instanceof CheckError) || e.retry;
    const message = e instanceof Error ? e.message : "The label couldn't be checked.";
    const appId = record({
      outcome: retry ? "error" : "unreadable",
      quality: null,
      why: retry ? "The automatic check didn't finish. Check it by eye." : message,
      ms: Math.round(performance.now() - started),
    });
    if (!retry) primePrecheck(appId, { state: "error", message, retry: false });
  } finally {
    busy--;
    if (fromBacklog) fromBacklogBusy--;
  }
}

function tick() {
  if (document.hidden) return;
  const { automation } = currentDemo();
  if (!automation.running) return;
  const waiting = automation.backlog - fromBacklogBusy;
  // A batch gets every reader but one; the trickle gets one.
  const max = waiting > 0 ? Math.max(1, readerCount() - 1) : 1;
  while (busy < max) {
    const fromBacklog = automation.backlog - fromBacklogBusy > 0;
    if (!fromBacklog && Date.now() - lastArrival < TRICKLE_MS) return;
    void checkOne(fromBacklog);
  }
}

/** Runs the automatic checks while they're switched on. Mount once. */
export function useAutomation(running: boolean) {
  useEffect(() => {
    if (!running) return;
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [running]);
}
