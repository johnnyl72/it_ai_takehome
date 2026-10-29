"use client";

import { useId, useState } from "react";
import { dispatch, resetDemo, useDemo } from "@/lib/client/demo";
import { useNow } from "@/lib/client/now";
import { CHECK_TARGET_MS, health } from "@/lib/demo/metrics";
import { blocked, can, me, type DemoAction } from "@/lib/demo/store";
import type { DemoState } from "@/lib/demo/types";
import { BEVERAGES, PERMISSIONS, ROLES, type Beverage, type Role } from "@/lib/demo/users";
import { ActivityFeed } from "./ActivityFeed";
import { StatusMark } from "./StatusMark";

const ROLE_IDS = Object.keys(ROLES) as Role[];

/** A control the signed-in admin may not use says why, right under it. */
function Why({ id, reason }: { id: string; reason: string | null }) {
  return reason ? (
    <p id={id} className="mt-1 text-sm text-muted">
      {reason}
    </p>
  ) : null;
}

export function Admin() {
  const s = useDemo();
  const user = me(s);
  const isAdmin = can(s, user.id, "admin");
  return (
    <div className="space-y-10">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">Admin</h1>
        <p className="mt-2 text-lg">
          Who can sign in, what each role can see and do, and how the system is running.
        </p>
      </div>
      {can(s, user.id, "system.health") && <SystemHealth state={s} />}
      {isAdmin && <AutomationSettings state={s} />}
      {isAdmin && <Users state={s} />}
      {isAdmin && <Roles state={s} />}
      {isAdmin && (
        <section aria-labelledby="log" className="space-y-4">
          <div>
            <h2 id="log" className="text-2xl font-bold">
              Audit log
            </h2>
            <p className="text-muted">Every action in the demo, including every change made on this page.</p>
          </div>
          <ActivityFeed state={s} kinds="all" />
        </section>
      )}
      {isAdmin && <Reset />}
    </div>
  );
}

function SystemHealth({ state: s }: { state: DemoState }) {
  const h = health(s, useNow());
  const sec = (ms: number | null) => (ms === null ? "None yet" : `${(ms / 1000).toFixed(1)} s`);
  const p95ok = h.p95Ms !== null && h.p95Ms <= CHECK_TARGET_MS;
  const tiles = [
    { label: "Checks run", value: h.checks.toLocaleString() },
    { label: "Median check time", value: sec(h.medianMs) },
    { label: "95% finish within", value: sec(h.p95Ms), mark: h.p95Ms !== null },
    { label: "Over 5 seconds", value: h.overTarget.toLocaleString() },
    {
      label: "Couldn't read the image",
      value: h.checks ? `${((h.unreadable / h.checks) * 100).toFixed(1)}%` : "None yet",
    },
    { label: "Errors", value: h.errors.toLocaleString() },
  ];
  return (
    <section aria-labelledby="health" className="space-y-4">
      <div>
        <h2 id="health" className="text-2xl font-bold">
          System health, last 7 days
        </h2>
        <p className="text-muted">
          The target is a result within 5 seconds: slower than that and agents go back to checking by eye.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-line-soft">
            <dt className="text-muted">{t.label}</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-semibold tabular-nums">{t.value}</span>
              {t.mark && <StatusMark status={p95ok ? "pass" : "fail"} size="sm" />}
            </dd>
          </div>
        ))}
      </dl>
      <p className="max-w-4xl text-muted">
        Includes two weeks of made-up history so this isn&apos;t empty on a first visit; checks run in this
        browser are added as they happen. In production these come from OpenTelemetry into Azure Monitor, with
        an alert when the 95th percentile goes over 5 seconds.
      </p>
    </section>
  );
}

function AutomationSettings({ state: s }: { state: DemoState }) {
  const id = useId();
  const a = s.automation;
  return (
    <section aria-labelledby={`${id}-auto`} className="space-y-4">
      <div>
        <h2 id={`${id}-auto`} className="text-2xl font-bold">
          Automatic checks
        </h2>
        <p className="max-w-3xl text-muted">
          A label clears without a person only when every field matches the application, the government
          warning is word for word with a bold heading, and the image reads clearly. Anything else, or any
          doubt, goes to an agent. Nothing is ever sent back or rejected automatically.
        </p>
      </div>
      <div className="space-y-4 rounded-lg bg-white p-5 shadow-sm ring-1 ring-line-soft">
        <label className="flex cursor-pointer items-start gap-3 text-lg">
          <input
            type="checkbox"
            checked={a.running}
            onChange={() => dispatch({ type: "set-automation", running: !a.running })}
            className="mt-1 size-5 accent-blue"
          />
          <span>
            <span className="block font-semibold">Run the automatic checks</span>
            <span className="block text-base text-muted">
              Paused, new applications wait until they resume.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 text-lg">
          <input
            type="checkbox"
            checked={a.autoClear}
            onChange={() => dispatch({ type: "set-automation", autoClear: !a.autoClear })}
            className="mt-1 size-5 accent-blue"
          />
          <span>
            <span className="block font-semibold">Clear clean matches without a person</span>
            <span className="block text-base text-muted">
              Off, every application goes to an agent, with the check&apos;s result waiting for them.
            </span>
          </span>
        </label>
        <div>
          <label htmlFor={`${id}-sample`} className="block text-lg font-semibold">
            Spot checks
          </label>
          <p id={`${id}-sample-hint`} className="text-muted">
            How many automatic clearances go to a person anyway, to catch the checks being wrong.
          </p>
          <select
            id={`${id}-sample`}
            aria-describedby={`${id}-sample-hint`}
            value={a.sampleEvery}
            disabled={!a.autoClear}
            onChange={(e) => dispatch({ type: "set-automation", sampleEvery: Number(e.target.value) })}
            className="mt-1 rounded-md border-2 border-line bg-white px-3 py-2 focus:border-blue disabled:bg-page"
          >
            <option value={0}>None</option>
            {[50, 20, 10].map((n) => (
              <option key={n} value={n}>
                1 in {n}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

function Users({ state: s }: { state: DemoState }) {
  const base = useId();
  return (
    <section aria-labelledby="users" className="space-y-4">
      <div>
        <h2 id="users" className="text-2xl font-bold">
          Users
        </h2>
        <p className="text-muted">
          A deactivated user can&apos;t sign in, and their open work goes to someone else automatically. A
          specialty steers auto-assignment.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
        <table className="w-full text-left">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Specialty</th>
              <th className="px-4 py-3 font-semibold">Can sign in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {s.users.map((u) => {
              const selfWhy = u.id === s.currentUser ? "You can't change your own role." : null;
              const optionWhy = (r: Role) =>
                r === u.role ? null : blocked(s, { type: "set-role", userId: u.id, role: r });
              const roleWhy = selfWhy ?? ROLE_IDS.map(optionWhy).find(Boolean) ?? null;
              const toggle: DemoAction = { type: "set-active", userId: u.id, active: !u.active };
              const activeWhy = blocked(s, toggle);
              const id = `${base}-${u.id}`;
              return (
                <tr key={u.id} className="align-top">
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{u.name}</span>
                    <span className="block text-sm text-muted">{u.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      aria-label={`Role for ${u.name}`}
                      aria-describedby={roleWhy ? `${id}-role` : undefined}
                      value={u.role}
                      disabled={!!selfWhy}
                      onChange={(e) =>
                        dispatch({ type: "set-role", userId: u.id, role: e.target.value as Role })
                      }
                      className="rounded-md border-2 border-line bg-white px-2 py-1.5 focus:border-blue disabled:bg-page"
                    >
                      {ROLE_IDS.map((r) => (
                        <option key={r} value={r} disabled={!!optionWhy(r)}>
                          {ROLES[r].label}
                        </option>
                      ))}
                    </select>
                    <Why id={`${id}-role`} reason={roleWhy} />
                  </td>
                  <td className="px-4 py-3">
                    {!s.permissions[u.role].includes("queue.own") ? (
                      <span className="text-muted">No queue</span>
                    ) : (
                      <select
                        aria-label={`Specialty for ${u.name}`}
                        value={u.specialty ?? ""}
                        onChange={(e) =>
                          dispatch({
                            type: "set-specialty",
                            userId: u.id,
                            specialty: (e.target.value || null) as Beverage | null,
                          })
                        }
                        className="rounded-md border-2 border-line bg-white px-2 py-1.5 focus:border-blue"
                      >
                        <option value="">Any</option>
                        {(Object.keys(BEVERAGES) as Beverage[]).map((b) => (
                          <option key={b} value={b}>
                            {BEVERAGES[b]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 font-semibold has-disabled:cursor-not-allowed">
                      <input
                        type="checkbox"
                        checked={u.active}
                        disabled={!!activeWhy}
                        aria-describedby={activeWhy ? `${id}-active` : undefined}
                        onChange={() => dispatch(toggle)}
                        className="size-5 accent-blue"
                      />
                      {u.active ? "Active" : "Deactivated"}
                    </label>
                    <Why id={`${id}-active`} reason={activeWhy} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Roles({ state: s }: { state: DemoState }) {
  const base = useId();
  return (
    <section aria-labelledby="roles" className="space-y-4">
      <div>
        <h2 id="roles" className="text-2xl font-bold">
          What each role can see and do
        </h2>
        <p className="text-muted">
          Changes apply at once: switch user at the top right to see the difference. Here the screens hide
          what a role can&apos;t use, and every action is checked again before it&apos;s recorded, the way a
          server would.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
        <table className="w-full text-left">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Permission</th>
              {ROLE_IDS.map((r) => (
                <th key={r} className="px-4 py-3 text-center font-semibold whitespace-nowrap">
                  {ROLES[r].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {PERMISSIONS.map((p) => (
              <tr key={p.id}>
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="block font-semibold">{p.label}</span>
                  <span className="block text-sm text-muted">{p.detail}</span>
                </th>
                {ROLE_IDS.map((r) => {
                  const action: DemoAction = { type: "toggle-permission", role: r, permission: p.id };
                  const why = blocked(s, action);
                  const id = `${base}-${r}-${p.id}`;
                  return (
                    <td key={r} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={s.permissions[r].includes(p.id)}
                        disabled={!!why}
                        aria-label={`${ROLES[r].label}: ${p.label}`}
                        aria-describedby={why ? id : undefined}
                        onChange={() => dispatch(action)}
                        className="size-5 accent-blue"
                      />
                      {why && (
                        <span id={id} className="mt-1 block text-xs text-muted">
                          Always on
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted">
        Admin&apos;s &ldquo;Manage users and roles&rdquo; is always on, so someone can always manage users.
        The last active admin can&apos;t be deactivated or demoted.
      </p>
    </section>
  );
}

function Reset() {
  const [sure, setSure] = useState(false);
  return (
    <section aria-labelledby="reset" className="space-y-3 border-t border-line pt-8">
      <h2 id="reset" className="text-2xl font-bold">
        Reset the demo
      </h2>
      <p className="text-muted">
        Puts back the starting queue, users, roles and history. Only this browser is affected.
      </p>
      {sure ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold">Reset everything?</span>
          <button
            type="button"
            onClick={() => {
              resetDemo();
              setSure(false);
            }}
            className="rounded-md bg-fail px-5 py-2.5 font-semibold text-white hover:opacity-90"
          >
            Yes, reset
          </button>
          <button
            type="button"
            onClick={() => setSure(false)}
            className="rounded-md border-2 border-blue bg-white px-5 py-2.5 font-semibold text-blue hover:bg-blue-soft"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSure(true)}
          className="rounded-md border-2 border-fail bg-white px-5 py-2.5 font-semibold text-fail hover:bg-fail-soft"
        >
          Reset demo data
        </button>
      )}
    </section>
  );
}
