"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { dispatch, useDemo } from "@/lib/client/demo";
import { useNow } from "@/lib/client/now";
import { precheckOf, requestPrecheck, usePrechecks, type PrecheckState } from "@/lib/client/precheck";
import { ago, describe, nameOf, when } from "@/lib/demo/describe";
import { agentWeek, workTimes } from "@/lib/demo/metrics";
import { issues } from "@/lib/demo/reasons";
import { kitEntry } from "@/lib/demo/seed";
import { blocked, can, canView, me, needsReason } from "@/lib/demo/store";
import {
  isOpen,
  STATUS_LABEL,
  type Decision,
  type DemoApplication,
  type DemoState,
  type EventOf,
} from "@/lib/demo/types";
import { BEVERAGES } from "@/lib/demo/users";
import { TEST_KIT_DIR } from "@/lib/samples";
import { NoAccess } from "./Access";
import { ResultView } from "./ResultView";
import { StatusPill } from "./Workflow";

const CHOICES: { id: Decision; label: string; detail: string }[] = [
  { id: "approved", label: "Approve", detail: "The label matches the application." },
  { id: "needs-correction", label: "Needs correction", detail: "Send it back for the applicant to fix." },
  { id: "rejected", label: "Reject", detail: "Deny the application." },
];

/** What the check found wrong, as a starting point for the reason the applicant reads. */
function suggestedReason(p: PrecheckState | undefined): string {
  if (p?.state === "error" && !p.retry)
    return "Send a clearer image of the label, at least 1500 pixels on its long side.";
  return p?.state === "done" ? issues(p.result).join("\n") : "";
}

/** This person's open work in queue order (oldest first), the list Previous and Next move through. */
function workList(s: DemoState): DemoApplication[] {
  const team = can(s, s.currentUser, "queue.team");
  return s.applications
    .filter((a) => isOpen(a.status) && (team || a.assignee === s.currentUser))
    .sort((a, b) => a.receivedAt - b.receivedAt);
}

/** The next one to work on after this one; the oldest if this one isn't in the list. */
function nextFor(s: DemoState, after: string): DemoApplication | undefined {
  const list = workList(s).filter((a) => a.id !== after);
  const at = s.applications.find((a) => a.id === after)?.receivedAt ?? 0;
  return list.find((a) => a.receivedAt > at) ?? list[0];
}

export function ApplicationReview() {
  const id = useSearchParams().get("id");
  const s = useDemo();
  const prechecks = usePrechecks();
  const user = me(s);
  const app = s.applications.find((a) => a.id === id);
  const allowed = !!app && canView(s, user.id, app);
  const opened = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const now = useNow();
  const next = app ? nextFor(s, app.id) : undefined;

  useEffect(() => {
    if (!app || !allowed) return;
    requestPrecheck(app, true);
    // The one after this is checked in the background, so moving on is instant.
    if (next) requestPrecheck(next);
    // Opening is an audit event, logged once per visit (not again on every re-render).
    if (opened.current !== app.id) {
      opened.current = app.id;
      dispatch({ type: "open", appId: app.id });
      heading.current?.focus({ preventScroll: true });
    }
  }, [app, allowed, next]);

  const back = can(s, user.id, "queue.team") ? "Back to the team queue" : "Back to my queue";
  if (!app)
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-navy">This application isn&apos;t in the demo</h1>
        <Link href="/" className="text-lg text-blue underline underline-offset-2">
          {back}
        </Link>
      </div>
    );
  if (!allowed) return <NoAccess what="this application, which is assigned to someone else" />;

  const entry = kitEntry(app.kitFile)!;
  const p = prechecks.get(app.id);
  const image = `${TEST_KIT_DIR}/labels/${app.kitFile}`;
  const history = s.events.filter((e) => "appId" in e && e.appId === app.id);
  const times = workTimes(s.events);

  return (
    <div className="space-y-6">
      <WorkBar state={s} app={app} now={now} back={back} flash={flash} onMove={() => setFlash(null)} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            ref={heading}
            tabIndex={-1}
            className="font-serif text-3xl font-bold text-navy outline-none sm:text-4xl"
          >
            {app.brand}
          </h1>
          <p className="mt-1 text-lg text-muted">
            TTB ID <span className="tabular-nums">{app.ttbId}</span>. {BEVERAGES[app.beverage]} from{" "}
            {app.applicant}. Received {ago(app.receivedAt, now).toLowerCase()}, assigned to{" "}
            {nameOf(s, app.assignee)}.
          </p>
        </div>
        <StatusPill status={app.status} />
      </div>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-3 lg:sticky lg:top-6">
          <h2 className="text-xl font-bold">Label image</h2>
          <a href={image} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- a test-kit file served as is */}
            <img
              src={image}
              alt={`The label submitted for ${app.brand}`}
              className="max-h-[75vh] w-full rounded-lg bg-white object-contain ring-1 ring-line"
            />
            <span className="mt-2 inline-block text-blue underline underline-offset-2">
              Open full size in a new tab
            </span>
          </a>
        </div>

        <div className="space-y-6">
          {app.why && (
            <p
              role="note"
              className={`rounded-md border-l-8 p-4 text-lg ${app.spotCheck ? "border-blue bg-blue-soft" : "border-review bg-review-soft"}`}
            >
              <strong className="font-semibold">
                {app.spotCheck ? "Why you're seeing this:" : "Flagged by the automatic check:"}
              </strong>{" "}
              {app.spotCheck
                ? "it cleared automatically, and a sample of clearances is checked by a person."
                : app.why}
            </p>
          )}
          <Check value={p} showText={can(s, user.id, "ocr.text")} />
          <DecisionPanel key={app.id} state={s} app={app} precheck={p} next={next} onRecorded={setFlash} />

          <details className="rounded-lg bg-white p-5 ring-1 ring-line-soft">
            <summary className="cursor-pointer text-lg font-semibold">What the application says</summary>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
              {(
                [
                  ["Brand name", entry.sample.application.brandName],
                  ["Class / type", entry.sample.application.classType],
                  ["Alcohol content", entry.sample.application.alcoholContent],
                  ["Net contents", entry.sample.application.netContents],
                  ["Bottler or producer", entry.sample.application.bottler],
                  ["Country of origin", entry.sample.application.countryOfOrigin],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-semibold text-muted">{k}</dt>
                  <dd className="font-serif text-lg">
                    {v || <span className="font-sans text-muted italic">(blank)</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </details>

          <section aria-labelledby="history" className="rounded-lg bg-white p-5 ring-1 ring-line-soft">
            <h2 id="history" className="text-lg font-semibold">
              History
            </h2>
            <p className="text-muted">
              Everything that has happened to this application, including who opened it.
            </p>
            <ol className="mt-3 space-y-2">
              {[...history].reverse().map((e) => (
                <li key={e.id} className="grid gap-x-4 sm:grid-cols-[10rem_1fr]">
                  <span className="text-muted">{when(e.at, now)}</span>
                  <span>{describe(s, e, e.type === "decided" ? times.get(e.id) : undefined)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Stays at the top while an agent works through their queue: where they are,
 * how the day is going, and a way to move on without going back to the list.
 */
function WorkBar({
  state: s,
  app,
  now,
  back,
  flash,
  onMove,
}: {
  state: DemoState;
  app: DemoApplication;
  now: number;
  back: string;
  flash: string | null;
  onMove: () => void;
}) {
  const list = workList(s);
  const i = list.findIndex((a) => a.id === app.id);
  const prev = i > 0 ? list[i - 1] : undefined;
  const next = nextFor(s, app.id);
  const done = agentWeek(s, s.currentUser, now).finishedToday;
  const button =
    "rounded-md border-2 px-4 py-2 font-semibold whitespace-nowrap aria-disabled:pointer-events-none aria-disabled:opacity-40";
  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-page/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" className="text-blue underline underline-offset-2">
          {back}
        </Link>
        <p className="text-lg">
          <strong className="font-semibold tabular-nums">
            {i >= 0 ? `${i + 1} of ${list.length}` : `${list.length} left`}
          </strong>{" "}
          to work on
          <span className="text-muted"> · {done} finished today</span>
        </p>
        <div className="ml-auto flex gap-2">
          <Link
            href={prev ? `/review?id=${prev.id}` : "#"}
            aria-disabled={!prev}
            onClick={onMove}
            className={`${button} border-blue bg-white text-blue hover:bg-blue-soft`}
          >
            Previous
          </Link>
          <Link
            href={next ? `/review?id=${next.id}` : "#"}
            aria-disabled={!next}
            onClick={onMove}
            className={`${button} border-blue bg-blue text-white hover:bg-blue-dark`}
          >
            {next ? "Next" : "No more"}
          </Link>
        </div>
      </div>
      {flash && (
        <p role="status" className="mt-2 font-semibold text-pass">
          {flash}
        </p>
      )}
    </div>
  );
}

function Check({ value, showText }: { value: PrecheckState | undefined; showText: boolean }) {
  if (value?.state === "done") return <ResultView result={value.result} showReadText={showText} />;
  if (value?.state === "error")
    return (
      <div role="alert" className="rounded-md border-l-8 border-review bg-review-soft p-4 text-lg">
        <strong className="font-semibold">The label couldn&apos;t be checked.</strong> {value.message}
      </div>
    );
  return (
    <p aria-live="polite" className="rounded-lg bg-white p-5 text-lg ring-1 ring-line-soft">
      {value?.state === "checking" ? "Reading the label…" : "Waiting for a free reader…"}
    </p>
  );
}

function DecisionPanel({
  state: s,
  app,
  precheck,
  next,
  onRecorded,
}: {
  state: DemoState;
  app: DemoApplication;
  precheck: PrecheckState | undefined;
  next: DemoApplication | undefined;
  onRecorded: (message: string) => void;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [suggested, setSuggested] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<Decision | null>(null);
  const reasonId = useId();
  const confirm = useRef<HTMLDivElement>(null);
  const user = me(s);
  const now = useNow();
  const verdict = precheckOf(precheck) ?? app.verdict;

  useEffect(() => {
    if (recorded) confirm.current?.focus();
  }, [recorded]);

  if (recorded) {
    return (
      <div
        ref={confirm}
        tabIndex={-1}
        role="status"
        className="space-y-4 rounded-lg border-l-8 border-pass bg-white p-5 shadow-sm ring-1 ring-line-soft outline-none"
      >
        <p className="text-xl font-bold">Recorded: {STATUS_LABEL[recorded]}.</p>
        <div className="flex flex-wrap gap-3">
          {next ? (
            <Link
              href={`/review?id=${next.id}`}
              className="rounded-md bg-blue px-6 py-3 text-lg font-semibold text-white hover:bg-blue-dark"
            >
              Next application: {next.brand}
            </Link>
          ) : (
            <p className="text-lg">That was the last open application.</p>
          )}
          <Link
            href="/"
            className="rounded-md border-2 border-blue bg-white px-6 py-3 text-lg font-semibold text-blue hover:bg-blue-soft"
          >
            Back to the queue
          </Link>
        </div>
      </div>
    );
  }

  if (!isOpen(app.status)) {
    const last = s.events.findLast(
      (e): e is EventOf<"decided"> => e.type === "decided" && e.appId === app.id,
    );
    return (
      <div className="rounded-lg bg-white p-5 ring-1 ring-line-soft">
        <h2 className="text-lg font-semibold">Decision</h2>
        <p className="text-lg">
          {STATUS_LABEL[app.status]}
          {last && `, by ${nameOf(s, last.actor)}, ${when(last.at, now)}`}.
        </p>
        {last?.reason && <p className="mt-1 whitespace-pre-line">Reason: {last.reason}</p>}
      </div>
    );
  }

  const may = can(s, user.id, "decide") && (app.assignee === user.id || can(s, user.id, "queue.team"));
  if (!may)
    return (
      <p className="rounded-lg bg-white p-5 text-lg ring-1 ring-line-soft">
        Assigned to {nameOf(s, app.assignee)}. Only they or a supervisor can record a decision.
      </p>
    );

  const required = choice ? needsReason(choice, verdict) : false;

  function choose(d: Decision) {
    setChoice(d);
    setError(null);
    // Offer what the check found, but never overwrite what the agent has written.
    const text = d === "approved" ? "" : suggestedReason(precheck);
    if (!reason.trim() || reason === suggested) {
      setReason(text);
      setSuggested(text);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choice) return setError("Choose a decision first.");
    const action = { type: "decide", appId: app.id, decision: choice, reason, precheck: verdict } as const;
    const why = blocked(s, action);
    if (why) return setError(why);
    dispatch(action);
    // Straight on to the next one, with a line saying what was recorded.
    if (next) {
      onRecorded(`Recorded ${app.brand}: ${STATUS_LABEL[choice]}. This is the next one.`);
      router.push(`/review?id=${next.id}`);
    } else setRecorded(choice);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-line-soft sm:p-6"
    >
      <fieldset>
        <legend className="text-xl font-bold">Your decision</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {CHOICES.map((c) => (
            <label
              key={c.id}
              className={`cursor-pointer rounded-lg p-4 ring-2 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#2491ff] ${
                choice === c.id ? "bg-blue-soft ring-blue" : "ring-line hover:ring-blue"
              }`}
            >
              <input
                type="radio"
                name="decision"
                value={c.id}
                checked={choice === c.id}
                onChange={() => choose(c.id)}
                className="sr-only"
              />
              <span className="block text-lg font-bold">{c.label}</span>
              <span className="block text-muted">{c.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={reasonId} className="block text-lg font-semibold">
          Reason{!required && <span className="font-normal text-muted"> (optional)</span>}
        </label>
        <p id={`${reasonId}-hint`} className="text-muted">
          {choice === "approved" && required
            ? "The pre-check found a problem. Say why you're approving it anyway; a supervisor may check it."
            : choice && choice !== "approved"
              ? "The applicant reads this. It starts with what the check found; edit it as you need."
              : "Recorded with the decision."}
        </p>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          aria-describedby={`${reasonId}-hint`}
          className="mt-1 w-full rounded-md border-2 border-line bg-white px-3 py-2.5 text-lg focus:border-blue"
        />
      </div>

      {error && (
        <p role="alert" className="font-semibold text-fail">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="w-full rounded-md bg-blue px-6 py-4 text-xl font-bold text-white hover:bg-blue-dark"
      >
        {next ? "Record and open the next one" : "Record decision"}
      </button>
    </form>
  );
}
