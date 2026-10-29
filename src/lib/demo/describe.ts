/** Plain sentences for the activity feed and each application's history. */
import { PERMISSIONS, ROLES, BEVERAGES } from "./users";
import type { DemoEvent, DemoState, Precheck } from "./types";
import { STATUS_LABEL } from "./types";

const PRECHECK_WORDS: Record<Precheck | "error", string> = {
  pass: "Match",
  review: "Review",
  fail: "Problem",
  unreadable: "couldn't read the image",
  error: "didn't finish",
};

export const nameOf = (s: DemoState, id: string | null) =>
  id === "system" ? "The system" : (s.users.find((u) => u.id === id)?.name ?? "Someone");

export function minutes(ms: number): string {
  const m = ms / 60_000;
  return m < 1 ? "under a minute" : m < 10 ? `${m.toFixed(1)} min` : `${Math.round(m)} min`;
}

export function describe(s: DemoState, e: DemoEvent, workedMs?: number): string {
  const who = nameOf(s, e.actor);
  switch (e.type) {
    case "signed-in":
      return `${who} signed in.`;
    case "received":
      return `${e.brand} (${e.ttbId}) was received.`;
    case "assigned":
      if (e.by === "auto") return `${e.brand} was assigned to ${nameOf(s, e.to)} automatically.`;
      if (e.by === "balance") return `${who} balanced the queues: ${e.brand} moved to ${nameOf(s, e.to)}.`;
      return `${who} reassigned ${e.brand}${e.from ? ` from ${nameOf(s, e.from)}` : ""} to ${nameOf(s, e.to)}.`;
    case "opened":
      return `${who} opened ${e.brand}.`;
    case "checked":
      return e.outcome === "unreadable" || e.outcome === "error"
        ? `The pre-check of ${e.brand} ${PRECHECK_WORDS[e.outcome]}.`
        : `The pre-check of ${e.brand} found ${PRECHECK_WORDS[e.outcome]} in ${(e.ms / 1000).toFixed(1)} s.`;
    case "decided": {
      const after = workedMs !== undefined ? ` (${minutes(workedMs)} after opening it)` : "";
      return `${who} marked ${e.brand} ${STATUS_LABEL[e.decision]}${after}${e.reason ? `: ${e.reason.replace(/\.$/, "")}` : ""}.`;
    }
    case "role-changed":
      return `${who} made ${nameOf(s, e.userId)} ${e.role === "agent" ? "an" : "a"} ${ROLES[e.role].label.toLowerCase()}.`;
    case "active-changed":
      return `${who} ${e.active ? "reactivated" : "deactivated"} ${nameOf(s, e.userId)}.`;
    case "specialty-changed":
      return `${who} set ${nameOf(s, e.userId)}'s specialty to ${e.specialty ? BEVERAGES[e.specialty].toLowerCase() : "none"}.`;
    case "permission-changed": {
      const p = PERMISSIONS.find((x) => x.id === e.permission)?.label ?? e.permission;
      return e.granted
        ? `${who} gave the ${ROLES[e.role].label} role “${p}”.`
        : `${who} took “${p}” away from the ${ROLES[e.role].label} role.`;
    }
  }
}

const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const date = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });

/** "10:42 AM", "Yesterday, 3:10 PM", or "Mon, Oct 26, 3:10 PM". */
export function when(at: number, now: number): string {
  const d = new Date(at);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return time.format(d);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time.format(d)}`;
  return `${date.format(d)}, ${time.format(d)}`;
}

/** "Today", "Yesterday", "3 days ago". */
export function ago(at: number, now: number): string {
  const start = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((start(now) - start(at)) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

export const daysWaiting = (at: number, now: number) =>
  Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 86_400_000);
