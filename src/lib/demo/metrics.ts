/**
 * Every number on the Team and System health screens, computed from the
 * event log. Nothing is counted as it happens, so a number can always be
 * traced back to the events behind it, and a new question needs only a new
 * function, not a migration.
 */
import { assignable } from "./store";
import { DAY } from "./seed";
import type { DemoEvent, DemoState, EventOf } from "./types";
import { isOpen } from "./types";

/** Sarah's limit from the interviews: slower than this and agents stop using it. */
export const CHECK_TARGET_MS = 5000;
/** An application waiting longer than this is flagged on the Team page. */
export const WAIT_TARGET_DAYS = 3;

export function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function median(xs: number[]): number | null {
  return percentile(xs, 50);
}

/** Nearest-rank percentile; null for no data. */
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const decisions = (events: DemoEvent[]) =>
  events.filter((e): e is EventOf<"decided"> => e.type === "decided");

/**
 * Time on each decision: from the decider's last opening of that
 * application to the decision. Keyed by the decision's event id.
 */
export function workTimes(events: DemoEvent[]): Map<number, number> {
  const opened = new Map<string, number>();
  const out = new Map<number, number>();
  for (const e of events) {
    if (e.type === "opened") opened.set(`${e.actor}|${e.appId}`, e.at);
    if (e.type === "decided") {
      const from = opened.get(`${e.actor}|${e.appId}`);
      if (from !== undefined) out.set(e.id, e.at - from);
    }
  }
  return out;
}

/** A decision that went against the tool's pre-check: worth a supervisor's second look. */
export function overrideOf(e: EventOf<"decided">): string | null {
  if (e.decision === "approved" && (e.precheck === "fail" || e.precheck === "unreadable"))
    return e.precheck === "fail"
      ? "Approved, but the pre-check found a problem"
      : "Approved an image the tool couldn't read";
  if (e.decision !== "approved" && e.precheck === "pass") return "Sent back, but the pre-check found a match";
  return null;
}

export interface AgentWeek {
  userId: string;
  finished: number;
  finishedToday: number;
  approved: number;
  needsCorrection: number;
  rejected: number;
  medianMs: number | null;
  slowestMs: number | null;
  overrides: number;
}

export function agentWeek(s: DemoState, userId: string, now: number, days = 7): AgentWeek {
  const since = startOfDay(now) - (days - 1) * DAY;
  const today = startOfDay(now);
  const times = workTimes(s.events);
  const mine = decisions(s.events).filter((e) => e.actor === userId && e.at >= since);
  const ms = mine.flatMap((e) => (times.has(e.id) ? [times.get(e.id)!] : []));
  return {
    userId,
    finished: mine.length,
    finishedToday: mine.filter((e) => e.at >= today).length,
    approved: mine.filter((e) => e.decision === "approved").length,
    needsCorrection: mine.filter((e) => e.decision === "needs-correction").length,
    rejected: mine.filter((e) => e.decision === "rejected").length,
    medianMs: median(ms),
    slowestMs: ms.length ? Math.max(...ms) : null,
    overrides: mine.filter((e) => overrideOf(e)).length,
  };
}

export interface Workload {
  userId: string;
  open: number;
  inReview: number;
  oldestReceivedAt: number | null;
}

/** Open work per assignable agent, from the applications as they are now. */
export function workloads(s: DemoState): Workload[] {
  return assignable(s).map((u) => {
    const open = s.applications.filter((a) => a.assignee === u.id && isOpen(a.status));
    return {
      userId: u.id,
      open: open.length,
      inReview: open.filter((a) => a.status === "in-review").length,
      oldestReceivedAt: open.length ? Math.min(...open.map((a) => a.receivedAt)) : null,
    };
  });
}

/** Applications finished per day, per person, oldest day first. */
export function finishedPerDay(
  s: DemoState,
  now: number,
  days = 7,
): { day: number; by: Record<string, number> }[] {
  const first = startOfDay(now) - (days - 1) * DAY;
  const out = Array.from({ length: days }, (_, i) => ({
    day: startOfDay(first + i * DAY + DAY / 2),
    by: {} as Record<string, number>,
  }));
  for (const e of decisions(s.events)) {
    if (e.at < first) continue;
    const slot = out.findLast((d) => d.day <= e.at);
    if (slot) slot.by[e.actor] = (slot.by[e.actor] ?? 0) + 1;
  }
  return out;
}

export function overrides(s: DemoState, now: number, days = 7) {
  const since = startOfDay(now) - (days - 1) * DAY;
  return decisions(s.events)
    .filter((e) => e.at >= since && overrideOf(e))
    .reverse();
}

export interface Health {
  checks: number;
  medianMs: number | null;
  p95Ms: number | null;
  overTarget: number;
  unreadable: number;
  errors: number;
}

export function health(s: DemoState, now: number, days = 7): Health {
  const since = startOfDay(now) - (days - 1) * DAY;
  const checks = s.events.filter((e): e is EventOf<"checked"> => e.type === "checked" && e.at >= since);
  const ms = checks.filter((c) => c.outcome !== "error").map((c) => c.ms);
  return {
    checks: checks.length,
    medianMs: median(ms),
    p95Ms: percentile(ms, 95),
    overTarget: ms.filter((m) => m > CHECK_TARGET_MS).length,
    unreadable: checks.filter((c) => c.outcome === "unreadable").length,
    errors: checks.filter((c) => c.outcome === "error").length,
  };
}
