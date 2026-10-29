"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useId, useState } from "react";
import { dispatch, useDemo } from "@/lib/client/demo";
import { download } from "@/lib/client/download";
import { useNow } from "@/lib/client/now";
import { nameOf, when } from "@/lib/demo/describe";
import { median, startOfDay } from "@/lib/demo/metrics";
import { assignable, can, canView, me } from "@/lib/demo/store";
import { isOpen, type DayTotals, type DemoApplication, type DemoState } from "@/lib/demo/types";
import { BEVERAGES } from "@/lib/demo/users";
import { ColumnChart } from "./ColumnChart";
import { StatusMark } from "./StatusMark";
import { StatusPill } from "./Workflow";

/** Validated as a pair (dataviz validator): blue for cleared, orange for flagged. */
const SERIES = [
  { key: "cleared", label: "Cleared", color: "#005ea2" },
  { key: "flagged", label: "Flagged", color: "#eb6834" },
];
const BATCH = 200;
const PAGE = 40;

const dayName = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "0%");

type Why = "all" | "fail" | "review" | "unreadable" | "spot";
const WHY: Record<Why, { label: string; has: (a: DemoApplication) => boolean }> = {
  all: { label: "Everything flagged", has: () => true },
  fail: { label: "Problems", has: (a) => a.verdict === "fail" },
  review: {
    label: "Needs a look",
    has: (a) => !a.spotCheck && (a.verdict === "review" || a.verdict === "pass"),
  },
  unreadable: { label: "Couldn't read", has: (a) => a.verdict === "unreadable" || a.verdict === null },
  spot: { label: "Spot checks", has: (a) => a.spotCheck },
};

export function Automation() {
  const s = useDemo();
  const now = useNow();
  const [tab, setTab] = useState<"flagged" | "cleared">("flagged");
  const user = me(s);
  const today = s.days.find((d) => d.day === startOfDay(now)) ?? s.days.at(-1)!;
  const { running, backlog } = s.automation;
  const lastMinute =
    s.cleared.filter((c) => c.at > now - 60_000).length +
    s.applications.filter((a) => a.id.startsWith("n") && a.receivedAt > now - 60_000).length;
  const typical = median(s.automation.recentMs);
  // Every application in the demo got here because the automatic check flagged it.
  const openCount = s.applications.filter((a) => isOpen(a.status)).length;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">Automatic checks</h1>
        <p className="mt-2 text-lg">
          Every new application is read and checked as it arrives. A clean match on a good image is cleared
          without a person. Anything else goes to an agent&apos;s queue with the reason
          {s.automation.sampleEvery
            ? `, and 1 in ${s.automation.sampleEvery} clearances goes to one anyway as a spot check`
            : ""}
          . Nothing is sent back or rejected without a person.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-white p-4 shadow-sm ring-1 ring-line-soft">
        <p aria-live="polite" className="flex items-center gap-3 text-lg">
          <span
            aria-hidden
            className={`size-3 rounded-full ${running ? "bg-pass motion-safe:animate-pulse" : "bg-line"}`}
          />
          <span>
            <strong className="font-semibold">{running ? "Running" : "Paused"}.</strong>{" "}
            {running
              ? `${lastMinute} checked in the last minute${typical !== null ? `, ${(typical / 1000).toFixed(1)} s each at the median` : ""}.`
              : "New applications wait until the checks resume."}
            {backlog > 0 && ` ${backlog} from an importer's batch still to check.`}
          </span>
        </p>
        <div className="ml-auto flex flex-wrap gap-3">
          {can(s, user.id, "admin") && (
            <button
              type="button"
              onClick={() => dispatch({ type: "set-automation", running: !running })}
              className="rounded-md border-2 border-blue bg-white px-4 py-2 font-semibold text-blue hover:bg-blue-soft"
            >
              {running ? "Pause" : "Resume"}
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: "queue-batch", count: BATCH })}
            className="rounded-md bg-blue px-4 py-2 font-semibold text-white hover:bg-blue-dark"
          >
            Simulate an importer&apos;s batch of {BATCH}
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Received today", value: today.received.toLocaleString() },
          {
            label: "Cleared automatically",
            value: today.cleared.toLocaleString(),
            sub: `${pct(today.cleared, today.received)} of today's`,
          },
          {
            label: "Flagged for a person",
            value: today.flagged.toLocaleString(),
            sub: `${pct(today.flagged, today.received)} of today's`,
          },
          {
            label: "Spot checks",
            value: today.spotChecks.toLocaleString(),
            sub: "Clearances a person confirms",
          },
        ].map((t) => (
          <div key={t.label} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-line-soft">
            <dt className="text-muted">{t.label}</dt>
            <dd className="text-3xl font-semibold tabular-nums">{t.value}</dd>
            {t.sub && <dd className="text-sm text-muted">{t.sub}</dd>}
          </div>
        ))}
      </dl>
      <p className="-mt-4 text-sm text-muted">
        Today&apos;s totals are for all of TTB: about 600 applications a working day. The checks listed below
        are the ones run in this browser, plus the demo&apos;s starting applications.
      </p>

      <section aria-label="Checked applications" className="space-y-4">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2 border-b border-line">
          {(
            [
              ["flagged", `Flagged for a person (${openCount} open)`],
              ["cleared", "Cleared automatically"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px rounded-t-md border-b-4 px-4 py-2.5 text-lg font-semibold ${
                tab === id ? "border-navy text-navy" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "flagged" ? <Flagged state={s} now={now} /> : <Cleared state={s} now={now} today={today} />}
      </section>

      <Report days={s.days} />
    </div>
  );
}

function Flagged({ state: s, now }: { state: DemoState; now: number }) {
  const [why, setWhy] = useState<Why>("all");
  const [who, setWho] = useState("everyone");
  const [status, setStatus] = useState<"open" | "done" | "all">("open");
  const [limit, setLimit] = useState(PAGE);
  const id = useId();
  const user = me(s);

  const rows = s.applications
    .filter(
      (a) =>
        WHY[why].has(a) &&
        (who === "everyone" || (who === "nobody" ? !a.assignee : a.assignee === who)) &&
        (status === "all" || (status === "open") === isOpen(a.status)),
    )
    .sort((a, b) => b.receivedAt - a.receivedAt);

  const select = "mt-1 rounded-md border-2 border-line bg-white px-3 py-2 focus:border-blue";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor={`${id}-why`} className="block font-semibold">
            Why
          </label>
          <select
            id={`${id}-why`}
            value={why}
            onChange={(e) => setWhy(e.target.value as Why)}
            className={select}
          >
            {(Object.keys(WHY) as Why[]).map((k) => (
              <option key={k} value={k}>
                {WHY[k].label} ({s.applications.filter(WHY[k].has).length})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-who`} className="block font-semibold">
            Assigned to
          </label>
          <select id={`${id}-who`} value={who} onChange={(e) => setWho(e.target.value)} className={select}>
            <option value="everyone">Everyone</option>
            {assignable(s).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
            <option value="nobody">Nobody</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-status`} className="block font-semibold">
            Status
          </label>
          <select
            id={`${id}-status`}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className={select}
          >
            <option value="open">Still open</option>
            <option value="done">Decided</option>
            <option value="all">All</option>
          </select>
        </div>
        <p className="pb-2 text-muted">{rows.length.toLocaleString()} shown</p>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
          <table className="w-full text-left">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Received</th>
                <th className="px-4 py-3 font-semibold">Brand</th>
                <th className="px-4 py-3 font-semibold">Found</th>
                <th className="px-4 py-3 font-semibold">Why it needs a person</th>
                <th className="px-4 py-3 font-semibold">Assigned to</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.slice(0, limit).map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-muted">{when(a.receivedAt, now)}</td>
                  <td className="px-4 py-3">
                    {canView(s, user.id, a) ? (
                      <Link
                        href={`/review?id=${a.id}`}
                        className="font-serif text-lg font-semibold text-blue underline underline-offset-2"
                      >
                        {a.brand}
                      </Link>
                    ) : (
                      <span className="font-serif text-lg font-semibold">{a.brand}</span>
                    )}
                    <span className="block text-sm text-muted tabular-nums">{a.ttbId}</span>
                  </td>
                  <td className="px-4 py-3">
                    {a.spotCheck ? (
                      <span className="inline-block rounded-full bg-blue-soft px-2 py-0.5 text-sm font-semibold whitespace-nowrap text-blue-dark">
                        Spot check
                      </span>
                    ) : a.verdict === "fail" || a.verdict === "review" || a.verdict === "pass" ? (
                      <StatusMark status={a.verdict} size="sm" />
                    ) : (
                      <span className="inline-block rounded-full bg-line-soft px-2 py-0.5 text-sm font-semibold whitespace-nowrap">
                        Couldn&apos;t read
                      </span>
                    )}
                  </td>
                  <td className="max-w-md px-4 py-3">{a.why}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{nameOf(s, a.assignee)}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-white p-5 text-muted ring-1 ring-line-soft">
          Nothing matches these filters.
        </p>
      )}
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="rounded-md border-2 border-blue bg-white px-4 py-2 font-semibold text-blue hover:bg-blue-soft"
        >
          Show {Math.min(PAGE, rows.length - limit)} more
        </button>
      )}
    </div>
  );
}

function Cleared({ state: s, now, today }: { state: DemoState; now: number; today: DayTotals }) {
  const [limit, setLimit] = useState(PAGE);
  const rows = [...s.cleared].reverse();
  return (
    <div className="space-y-4">
      <p className="text-muted">
        Every field matched and the image was clear, so no one needs to look. {today.cleared.toLocaleString()}{" "}
        cleared today across TTB; the latest {rows.length} from this demo are listed.
      </p>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
        <table className="w-full text-left">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Cleared</th>
              <th className="px-4 py-3 font-semibold">Brand</th>
              <th className="px-4 py-3 font-semibold">TTB ID</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Applicant</th>
              <th className="px-4 py-3 text-right font-semibold">Check time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.slice(0, limit).map((c) => (
              <tr key={c.ttbId}>
                <td className="px-4 py-3 whitespace-nowrap text-muted">{when(c.at, now)}</td>
                <td className="px-4 py-3 font-serif text-lg">{c.brand}</td>
                <td className="px-4 py-3 text-muted tabular-nums">{c.ttbId}</td>
                <td className="px-4 py-3">{BEVERAGES[c.beverage]}</td>
                <td className="px-4 py-3">{c.applicant}</td>
                <td className="px-4 py-3 text-right tabular-nums">{(c.ms / 1000).toFixed(1)} s</td>
              </tr>
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
    </div>
  );
}

const REPORT_COLUMNS: [keyof DayTotals | "share", string][] = [
  ["received", "Received"],
  ["cleared", "Cleared automatically"],
  ["share", "Share cleared"],
  ["flagged", "Flagged"],
  ["review", "Needs a look"],
  ["problem", "Problem"],
  ["unreadable", "Couldn't read"],
  ["spotChecks", "Spot checks"],
  ["finished", "Finished by people"],
];

function Report({ days }: { days: DayTotals[] }) {
  const value = (d: DayTotals, k: keyof DayTotals | "share") =>
    k === "share" ? pct(d.cleared, d.received) : k === "day" ? dayName.format(d.day) : d[k].toLocaleString();

  function save() {
    const rows = days.map((d) => ({
      Day: new Date(d.day).toISOString().slice(0, 10),
      ...Object.fromEntries(
        REPORT_COLUMNS.map(([k, label]) => [label, k === "share" ? pct(d.cleared, d.received) : d[k]]),
      ),
    }));
    download(`automatic-checks-${rows.at(-1)?.Day ?? "report"}.csv`, Papa.unparse(rows));
  }

  return (
    <section aria-labelledby="report" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="report" className="text-2xl font-bold">
            Day by day
          </h2>
          <p className="text-muted">
            The last 14 days across TTB. Filings keep arriving at weekends, when only the automatic checks are
            working, so Monday starts with what they flagged.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          className="rounded-md border-2 border-blue bg-white px-4 py-2 font-semibold text-blue hover:bg-blue-soft"
        >
          Download as CSV
        </button>
      </div>
      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-line-soft">
        <ColumnChart
          columns={days.map((d) => ({ day: d.day, values: { cleared: d.cleared, flagged: d.flagged } }))}
          series={SERIES}
          what="Applications checked"
        />
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
        <table className="w-full text-left">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Day</th>
              {REPORT_COLUMNS.map(([k, label]) => (
                <th key={k} className="px-4 py-3 text-right font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {[...days].reverse().map((d, i) => (
              <tr key={d.day} className={i === 0 ? "font-semibold" : undefined}>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {i === 0 ? "Today, so far" : value(d, "day")}
                </td>
                {REPORT_COLUMNS.map(([k]) => (
                  <td key={k} className="px-4 py-2.5 text-right tabular-nums">
                    {value(d, k)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
