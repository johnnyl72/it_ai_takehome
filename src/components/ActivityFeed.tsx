"use client";

import { useId, useState } from "react";
import { useNow } from "@/lib/client/now";
import { describe, when } from "@/lib/demo/describe";
import { workTimes } from "@/lib/demo/metrics";
import type { DemoEvent, DemoState } from "@/lib/demo/types";

const WORK = new Set<DemoEvent["type"]>(["signed-in", "received", "assigned", "opened", "decided"]);
const ADMIN = new Set<DemoEvent["type"]>([
  "role-changed",
  "active-changed",
  "specialty-changed",
  "permission-changed",
  "automation-changed",
  "batch-queued",
]);

const KINDS = {
  work: { label: "Work", has: (e: DemoEvent) => WORK.has(e.type) },
  admin: { label: "Changes to users, roles and settings", has: (e: DemoEvent) => ADMIN.has(e.type) },
  checks: { label: "Pre-checks", has: (e: DemoEvent) => e.type === "checked" },
  all: { label: "Everything", has: () => true },
};
type Kind = keyof typeof KINDS;

/** The event log as sentences, newest first, filtered by person and kind. */
export function ActivityFeed({ state: s, kinds }: { state: DemoState; kinds: "work" | "all" }) {
  const [who, setWho] = useState("people");
  const [kind, setKind] = useState<Kind>(kinds === "work" ? "work" : "admin");
  const [limit, setLimit] = useState(25);
  const whoId = useId();
  const kindId = useId();
  const now = useNow();
  const times = workTimes(s.events);

  const shown = s.events
    // The automatic checks log hundreds of events a day; people's actions are what's usually wanted.
    .filter(
      (e) =>
        KINDS[kind].has(e) &&
        (who === "everyone" || (who === "people" ? e.actor !== "system" : e.actor === who)),
    )
    .reverse();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor={whoId} className="block font-semibold">
            Person
          </label>
          <select
            id={whoId}
            value={who}
            onChange={(e) => setWho(e.target.value)}
            className="mt-1 rounded-md border-2 border-line bg-white px-3 py-2 focus:border-blue"
          >
            <option value="people">Everyone but the system</option>
            <option value="everyone">Everyone, including the system</option>
            {s.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
            <option value="system">The system</option>
          </select>
        </div>
        {kinds === "all" && (
          <div>
            <label htmlFor={kindId} className="block font-semibold">
              Show
            </label>
            <select
              id={kindId}
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="mt-1 rounded-md border-2 border-line bg-white px-3 py-2 focus:border-blue"
            >
              {(Object.keys(KINDS) as Kind[]).map((k) => (
                <option key={k} value={k}>
                  {KINDS[k].label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {shown.length ? (
        <ol className="divide-y divide-line-soft rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
          {shown.slice(0, limit).map((e) => (
            <li key={e.id} className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
              <span className="text-muted">{when(e.at, now)}</span>
              <span>{describe(s, e, e.type === "decided" ? times.get(e.id) : undefined)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-lg bg-white p-5 text-muted ring-1 ring-line-soft">Nothing yet.</p>
      )}
      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + 50)}
          className="rounded-md border-2 border-blue bg-white px-4 py-2 font-semibold text-blue hover:bg-blue-soft"
        >
          Show more ({shown.length - limit} older)
        </button>
      )}
    </div>
  );
}
