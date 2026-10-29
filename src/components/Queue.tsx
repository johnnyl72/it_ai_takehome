"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dispatch, useDemo } from "@/lib/client/demo";
import { useNow } from "@/lib/client/now";
import { requestPrecheck, usePrechecks, type PrecheckState } from "@/lib/client/precheck";
import { ago, daysWaiting, minutes, nameOf } from "@/lib/demo/describe";
import { agentWeek, startOfDay, WAIT_TARGET_DAYS } from "@/lib/demo/metrics";
import { assignable, can, me } from "@/lib/demo/store";
import { isOpen, type AppStatus, type DemoApplication, type Precheck } from "@/lib/demo/types";
import { BEVERAGES, firstName, ROLES } from "@/lib/demo/users";
import { PrecheckMark, StatusPill } from "./Workflow";

type Group = "open" | "waiting" | "finished";

/** How many of the oldest open applications to have fully checked before they're opened. */
const PREFETCH = 3;
const PAGE = 50;
/** An application this recent gets a "New" tag. */
const NEW_MS = 2 * 60_000;

const GROUPS: { id: Group; label: string; detail: string; has: (s: AppStatus) => boolean }[] = [
  { id: "open", label: "To work on", detail: "Received or in review", has: isOpen },
  {
    id: "waiting",
    label: "Waiting on applicant",
    detail: "Sent back to fix",
    has: (s) => s === "needs-correction",
  },
  {
    id: "finished",
    label: "Finished",
    detail: "Approved or rejected",
    has: (s) => s === "approved" || s === "rejected",
  },
];

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function Queue() {
  const s = useDemo();
  const prechecks = usePrechecks();
  const [group, setGroup] = useState<Group>("open");
  const [limit, setLimit] = useState(PAGE);
  const user = me(s);
  const team = can(s, user.id, "queue.team");
  const own = can(s, user.id, "queue.own");
  const now = useNow();

  const visible = s.applications.filter((a) => team || a.assignee === user.id);
  const open = visible.filter((a) => isOpen(a.status));

  // The automatic check's verdict is stored, but not the full result (it holds the label's text).
  // Fetch that for the next few this person is likely to open, so opening them is instant.
  const next = open
    .filter((a) => team || a.assignee === user.id)
    .sort((a, b) => a.receivedAt - b.receivedAt)
    .slice(0, PREFETCH);
  const nextIds = next.map((a) => a.id).join();
  useEffect(() => {
    next.forEach((a) => requestPrecheck(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the next few change
  }, [nextIds]);

  if (!own && !team) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-3xl font-bold text-navy">
          {greeting(now)}, {firstName(user)}.
        </h1>
        <p className="text-lg">
          As {ROLES[user.role].label.toLowerCase()}, you don&apos;t have a queue of applications.{" "}
          {can(s, user.id, "admin") || can(s, user.id, "system.health") ? (
            <>
              Your work is on the{" "}
              <Link href="/admin" className="font-semibold text-blue underline underline-offset-2">
                Admin page
              </Link>
              .
            </>
          ) : (
            "Ask your system admin if you should have one."
          )}
        </p>
      </div>
    );
  }

  const week = own && can(s, user.id, "stats.own") ? agentWeek(s, user.id, now) : null;
  const current = GROUPS.find((g) => g.id === group)!;
  const rows = visible
    .filter((a) => current.has(a.status))
    .sort((a, b) => (group === "open" ? a.receivedAt - b.receivedAt : b.receivedAt - a.receivedAt));
  const agents = assignable(s);
  const today = s.days.find((d) => d.day === startOfDay(now));
  // A finished application's pre-check is in its decision; only open ones are re-checked.
  const recorded = new Map<string, Precheck | null>();
  for (const e of s.events) if (e.type === "decided") recorded.set(e.appId, e.precheck);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">
          {greeting(now)}, {firstName(user)}.
        </h1>
        <p className="mt-1 text-xl">
          {team
            ? `${plural(open.length, "open application")} across the team.`
            : open.length
              ? `${plural(open.length, "application")} to work on.`
              : "Nothing to work on right now. New applications are assigned automatically."}
        </p>
        {week && (
          <p className="mt-1 text-muted">
            {week.finished
              ? `You've finished ${week.finished} in the last 7 days${
                  week.medianMs !== null ? `, ${minutes(week.medianMs)} per application at the median` : ""
                }.`
              : "You haven't finished any applications in the last 7 days."}
          </p>
        )}
        {today && (
          <p className="mt-3 max-w-3xl rounded-md bg-pass-soft px-4 py-2.5 text-ink">
            The automatic checks have cleared{" "}
            <strong className="font-semibold">{today.cleared.toLocaleString()} applications</strong> today
            with nothing wrong, so nobody needs to look at them. Everything here is something they flagged.{" "}
            {can(s, user.id, "automation.view") && (
              <Link href="/automation" className="font-semibold text-blue underline underline-offset-2">
                See the automatic checks
              </Link>
            )}
          </p>
        )}
      </div>

      <div role="group" aria-label="Show" className="grid grid-cols-3 gap-2 sm:gap-3">
        {GROUPS.map((g) => {
          const n = visible.filter((a) => g.has(a.status)).length;
          const on = g.id === group;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => setGroup(g.id)}
              className={`rounded-lg p-3 text-left ring-2 sm:p-4 ${
                on ? "bg-navy text-white ring-navy" : "bg-white text-ink ring-line-soft hover:ring-blue"
              }`}
            >
              <span className="block text-3xl font-bold tabular-nums sm:text-4xl">{n}</span>
              <span className="block leading-snug font-semibold sm:text-lg">{g.label}</span>
              <span className={`hidden sm:block ${on ? "text-white/80" : "text-muted"}`}>{g.detail}</span>
            </button>
          );
        })}
      </div>

      {rows.length ? (
        <>
          {/* A phone gets cards: a wide table that scrolls sideways is easy to lose your place in. */}
          <ul className="space-y-3 md:hidden">
            {rows.slice(0, limit).map((a) => (
              <Card
                key={a.id}
                app={a}
                now={now}
                team={team}
                agents={agents}
                assignee={nameOf(s, a.assignee)}
                precheck={prechecks.get(a.id)}
                recorded={recorded.get(a.id) ?? null}
              />
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft md:block">
            <table className="w-full text-left">
              <caption className="sr-only">
                {current.label}: {plural(rows.length, "application")}
              </caption>
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Brand</th>
                  <th className="px-4 py-3 font-semibold">TTB ID</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Applicant</th>
                  <th className="px-4 py-3 font-semibold">Received</th>
                  {team && <th className="px-4 py-3 font-semibold">Assigned to</th>}
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Check found</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.slice(0, limit).map((a) => (
                  <Row
                    key={a.id}
                    app={a}
                    now={now}
                    team={team}
                    agents={agents}
                    assignee={nameOf(s, a.assignee)}
                    precheck={prechecks.get(a.id)}
                    recorded={recorded.get(a.id) ?? null}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className="rounded-md border-2 border-blue bg-white px-4 py-2 font-semibold text-blue hover:bg-blue-soft"
            >
              Show {Math.min(PAGE, rows.length - limit)} more
            </button>
          )}
        </>
      ) : (
        <p className="rounded-lg bg-white p-6 text-lg text-muted ring-1 ring-line-soft">
          {group === "open"
            ? "Nothing here. New applications are assigned automatically."
            : group === "waiting"
              ? "No applications are waiting on an applicant."
              : "Nothing finished yet."}
        </p>
      )}
    </div>
  );
}

interface RowProps {
  app: DemoApplication;
  now: number;
  team: boolean;
  agents: { id: string; name: string }[];
  assignee: string;
  precheck: PrecheckState | undefined;
  recorded: Precheck | null;
}

function Assignee({ app, agents, assignee }: Pick<RowProps, "app" | "agents" | "assignee">) {
  if (!isOpen(app.status)) return <span className="text-muted">{assignee}</span>;
  return (
    <select
      aria-label={`Assigned to, for ${app.brand}`}
      value={app.assignee ?? ""}
      onChange={(e) => dispatch({ type: "reassign", appId: app.id, to: e.target.value })}
      className="rounded-md border-2 border-line bg-white px-2 py-1.5 focus:border-blue"
    >
      {!app.assignee && <option value="">Nobody</option>}
      {agents.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}

function Received({ app, now }: Pick<RowProps, "app" | "now">) {
  const late = isOpen(app.status) && daysWaiting(app.receivedAt, now) > WAIT_TARGET_DAYS;
  return (
    <>
      {ago(app.receivedAt, now)}
      {late && <span className="block text-sm font-semibold text-review">Over {WAIT_TARGET_DAYS} days</span>}
    </>
  );
}

function Card({ app, now, team, agents, assignee, precheck, recorded }: RowProps) {
  const href = `/review?id=${app.id}`;
  return (
    <li className="space-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-line-soft">
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="font-serif text-xl font-semibold text-blue underline underline-offset-2">
          {app.brand}
        </Link>
        <StatusPill status={app.status} />
      </div>
      <Why app={app} now={now} />
      <p className="text-muted">
        {BEVERAGES[app.beverage]} from {app.applicant}. <span className="tabular-nums">{app.ttbId}</span>
      </p>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-sm text-muted">Received</dt>
          <dd>
            <Received app={app} now={now} />
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Check found</dt>
          <dd>
            <PrecheckMark
              value={precheck}
              recorded={isOpen(app.status) ? app.verdict : (recorded ?? app.verdict)}
            />
          </dd>
        </div>
        {team && (
          <div className="col-span-2">
            <dt className="text-sm text-muted">Assigned to</dt>
            <dd>
              <Assignee app={app} agents={agents} assignee={assignee} />
            </dd>
          </div>
        )}
      </dl>
      <Link
        href={href}
        aria-label={`Open ${app.brand}`}
        className="block rounded-md bg-blue px-4 py-3 text-center text-lg font-semibold text-white hover:bg-blue-dark"
      >
        Open
      </Link>
    </li>
  );
}

/** Why the automatic check sent it to a person, with a tag while it's brand new. */
function Why({ app, now }: Pick<RowProps, "app" | "now">) {
  return (
    <>
      {now - app.receivedAt < NEW_MS && (
        <span className="ml-2 rounded-full bg-navy px-2 py-0.5 align-middle text-xs font-bold text-white">
          New
        </span>
      )}
      {app.why && <span className="mt-0.5 block max-w-sm text-sm text-muted line-clamp-2">{app.why}</span>}
    </>
  );
}

function Row({ app, now, team, agents, assignee, precheck, recorded }: RowProps) {
  const href = `/review?id=${app.id}`;
  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <Link href={href} className="font-serif text-lg font-semibold text-blue underline underline-offset-2">
          {app.brand}
        </Link>
        <Why app={app} now={now} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted">{app.ttbId}</td>
      <td className="px-4 py-3">{BEVERAGES[app.beverage]}</td>
      <td className="px-4 py-3">{app.applicant}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <Received app={app} now={now} />
      </td>
      {team && (
        <td className="px-4 py-3">
          <Assignee app={app} agents={agents} assignee={assignee} />
        </td>
      )}
      <td className="px-4 py-3">
        <StatusPill status={app.status} />
      </td>
      <td className="px-4 py-3">
        <PrecheckMark
          value={precheck}
          recorded={isOpen(app.status) ? app.verdict : (recorded ?? app.verdict)}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={href}
          aria-label={`Open ${app.brand}`}
          className="inline-block rounded-md bg-blue px-4 py-2 font-semibold text-white hover:bg-blue-dark"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}
