"use client";

import Link from "next/link";
import { useState } from "react";
import { currentDemo, dispatch, useDemo } from "@/lib/client/demo";
import { useNow } from "@/lib/client/now";
import { daysWaiting, minutes, nameOf, when } from "@/lib/demo/describe";
import {
  agentWeek,
  finishedPerDay,
  overrideOf,
  overrides,
  WAIT_TARGET_DAYS,
  workloads,
} from "@/lib/demo/metrics";
import { assignable } from "@/lib/demo/store";
import type { DemoState } from "@/lib/demo/types";
import { BEVERAGES } from "@/lib/demo/users";
import { ActivityFeed } from "./ActivityFeed";
import { ColumnChart } from "./ColumnChart";

/** "2 to Jenny Park, 1 to Janet" from the assignments the last action made. */
function summarize(s: DemoState, since: number): string {
  const count = new Map<string, number>();
  for (const e of s.events)
    if (e.id >= since && e.type === "assigned") count.set(e.to, (count.get(e.to) ?? 0) + 1);
  return [...count].map(([id, n]) => `${n} to ${nameOf(s, id)}`).join(", ");
}

export function Team() {
  const s = useDemo();
  const [message, setMessage] = useState("");
  const now = useNow();
  const agents = assignable(s);
  const loads = workloads(s);
  const people = s.users.filter((u) => agents.includes(u) || agentWeek(s, u.id, now).finished > 0);
  const weeks = people.map((u) => ({ user: u, week: agentWeek(s, u.id, now) }));
  const most = Math.max(1, ...weeks.map((w) => w.week.finished));
  const days = finishedPerDay(s, now).map((d) => ({
    day: d.day,
    values: { finished: Object.values(d.by).reduce((a, b) => a + b, 0) },
    details: people.map((u) => ({ name: u.name, n: d.by[u.id] ?? 0 })).filter((p) => p.n > 0),
  }));
  const spot = overrides(s, now);
  const unassigned = s.applications.filter(
    (a) => !a.assignee && (a.status === "received" || a.status === "in-review"),
  );

  function rebalance() {
    const since = s.nextEventId;
    dispatch({ type: "balance" });
    const moved = summarize(currentDemo(), since);
    setMessage(moved ? `Balanced: ${moved}.` : "The queues are already balanced.");
  }

  return (
    <div className="space-y-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">Team</h1>
        <p className="mt-2 text-lg">
          Who&apos;s working on what, and how the week is going. For balancing work and catching quality
          issues; each agent sees their own numbers on their queue page.
        </p>
      </div>

      <section aria-labelledby="workload" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="workload" className="text-2xl font-bold">
              Workload
            </h2>
            <p className="text-muted">
              Anything the automatic checks flag goes to the agent with the least open work, preferring one
              who specializes in that type. Reassign any of them from the team queue.
            </p>
          </div>
          <button
            type="button"
            onClick={rebalance}
            className="rounded-md bg-blue px-5 py-2.5 text-lg font-semibold text-white hover:bg-blue-dark"
          >
            Balance the queues
          </button>
        </div>
        <p aria-live="polite" className="min-h-7 font-semibold">
          {message}
        </p>
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
          <table className="w-full text-left">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Specialty</th>
                <th className="px-4 py-3 text-right font-semibold">Open</th>
                <th className="px-4 py-3 text-right font-semibold">In review</th>
                <th className="px-4 py-3 font-semibold">Oldest waiting</th>
                <th className="px-4 py-3 text-right font-semibold">Finished today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {loads.map((l) => {
                const u = s.users.find((x) => x.id === l.userId)!;
                const waited = l.oldestReceivedAt !== null ? daysWaiting(l.oldestReceivedAt, now) : null;
                return (
                  <tr key={l.userId}>
                    <td className="px-4 py-3 font-semibold">{u.name}</td>
                    <td className="px-4 py-3">{u.specialty ? BEVERAGES[u.specialty] : "Any"}</td>
                    <td className="px-4 py-3 text-right text-lg font-semibold tabular-nums">{l.open}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.inReview}</td>
                    <td className="px-4 py-3">
                      {waited === null ? (
                        <span className="text-muted">Nothing open</span>
                      ) : (
                        <>
                          {waited === 0 ? "Today" : `${waited} ${waited === 1 ? "day" : "days"}`}
                          {waited > WAIT_TARGET_DAYS && (
                            <span className="ml-2 text-sm font-semibold text-review">
                              over the {WAIT_TARGET_DAYS}-day target
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {agentWeek(s, l.userId, now).finishedToday}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {unassigned.length > 0 && (
          <p className="font-semibold text-review">
            {unassigned.length} open {unassigned.length === 1 ? "application has" : "applications have"}{" "}
            nobody to go to. Ask the system admin to give a role its own queue.
          </p>
        )}
      </section>

      <section aria-labelledby="week" className="space-y-4">
        <div>
          <h2 id="week" className="text-2xl font-bold">
            The last 7 days
          </h2>
          <p className="text-muted">
            Applications finished per day across the team. Point at a day to see who finished them. Time per
            application runs from opening it to the decision.
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-line-soft">
          <ColumnChart
            columns={days}
            series={[{ key: "finished", label: "Finished", color: "var(--color-blue)" }]}
            what="Applications finished"
          />
        </div>
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
          <table className="w-full text-left">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-4 py-3 font-semibold">Finished</th>
                <th className="px-4 py-3 text-right font-semibold">Approved</th>
                <th className="px-4 py-3 text-right font-semibold">Needs correction</th>
                <th className="px-4 py-3 text-right font-semibold">Rejected</th>
                <th className="px-4 py-3 text-right font-semibold">Median time</th>
                <th className="px-4 py-3 text-right font-semibold">Slowest</th>
                <th className="px-4 py-3 text-right font-semibold">Against the pre-check</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {weeks.map(({ user, week }) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-semibold">{user.name}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-3">
                      <span className="w-8 text-right text-lg font-semibold tabular-nums">
                        {week.finished}
                      </span>
                      <span aria-hidden className="h-3 w-28 rounded-sm bg-blue-soft">
                        <span
                          className="block h-3 rounded-sm bg-blue"
                          style={{ width: `${(week.finished / most) * 100}%` }}
                        />
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{week.approved}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{week.needsCorrection}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{week.rejected}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {week.medianMs !== null ? minutes(week.medianMs) : "None yet"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {week.slowestMs !== null ? minutes(week.slowestMs) : "None yet"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{week.overrides}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="spot" className="space-y-4">
        <div>
          <h2 id="spot" className="text-2xl font-bold">
            Spot checks
          </h2>
          <p className="text-muted">
            Decisions that went against the tool&apos;s pre-check in the last 7 days. Usually the agent is
            right and the reader misread something, but these are the ones worth a second look.
          </p>
        </div>
        {spot.length ? (
          <ul className="divide-y divide-line-soft rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
            {spot.slice(0, 12).map((e) => {
              const inQueue = s.applications.some((a) => a.id === e.appId);
              return (
                <li key={e.id} className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
                  <span className="text-muted">{when(e.at, now)}</span>
                  <span>
                    <span className="font-semibold">{overrideOf(e)}.</span> {nameOf(s, e.actor)},{" "}
                    {inQueue ? (
                      <Link
                        href={`/review?id=${e.appId}`}
                        className="font-serif text-blue underline underline-offset-2"
                      >
                        {e.brand}
                      </Link>
                    ) : (
                      <span className="font-serif">{e.brand}</span>
                    )}{" "}
                    <span className="text-muted tabular-nums">({e.ttbId})</span>
                    {e.reason && <span className="block text-muted">Reason given: {e.reason}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg bg-white p-5 text-muted ring-1 ring-line-soft">
            No decisions went against the pre-check this week.
          </p>
        )}
      </section>

      <section aria-labelledby="activity" className="space-y-4">
        <div>
          <h2 id="activity" className="text-2xl font-bold">
            Activity
          </h2>
          <p className="text-muted">Who did what, newest first. The same log is the audit trail.</p>
        </div>
        <ActivityFeed state={s} kinds="work" />
      </section>
    </div>
  );
}
