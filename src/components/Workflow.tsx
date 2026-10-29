"use client";

import type { PrecheckState } from "@/lib/client/precheck";
import { STATUS_LABEL, type AppStatus, type Precheck } from "@/lib/demo/types";
import { StatusMark } from "./StatusMark";

/**
 * Where an application is in the workflow. Kept neutral on purpose, so it
 * never competes with the coloured Match / Review / Problem of the check.
 */
export function StatusPill({ status }: { status: AppStatus }) {
  const done = status === "approved" || status === "rejected";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-sm font-semibold whitespace-nowrap ring-1 ${
        status === "in-review"
          ? "bg-blue-soft text-blue-dark ring-blue/30"
          : done
            ? "bg-white text-muted ring-line"
            : "bg-white text-ink ring-line"
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const COULDNT_READ = (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-line-soft px-2 py-0.5 text-sm font-semibold whitespace-nowrap text-ink">
    Couldn&apos;t read
  </span>
);

/**
 * The tool's check of an application: live while it runs, or, once decided,
 * what it said at the time (`recorded`).
 */
export function PrecheckMark({
  value,
  recorded,
}: {
  value: PrecheckState | undefined;
  recorded?: Precheck | null;
}) {
  if (recorded !== undefined && value?.state !== "done") {
    if (recorded === null) return <span className="text-muted">Not run</span>;
    return recorded === "unreadable" ? COULDNT_READ : <StatusMark status={recorded} size="sm" />;
  }
  if (!value || value.state === "waiting") return <span className="text-muted">Waiting</span>;
  if (value.state === "checking") return <span className="text-muted">Checking…</span>;
  if (value.state === "error")
    return value.retry ? <span className="text-muted">Not checked</span> : COULDNT_READ;
  return <StatusMark status={value.result.verdict} size="sm" />;
}
