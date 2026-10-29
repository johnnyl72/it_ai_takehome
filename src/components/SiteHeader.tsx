"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { dispatch, useDemo } from "@/lib/client/demo";
import { can, homeFor, me } from "@/lib/demo/store";
import type { DemoState } from "@/lib/demo/types";
import { ROLES, type DemoUser, type Permission } from "@/lib/demo/users";

const TABS: { href: string; label: (s: DemoState) => string; needs: Permission[] }[] = [
  {
    href: "/",
    label: (s) => (can(s, s.currentUser, "queue.team") ? "Team queue" : "My queue"),
    needs: ["queue.own", "queue.team"],
  },
  { href: "/team", label: () => "Team", needs: ["team.monitor"] },
  { href: "/check", label: () => "Check a label", needs: ["check.single"] },
  { href: "/batch", label: () => "Check a batch", needs: ["check.batch"] },
  { href: "/admin", label: () => "Admin", needs: ["admin", "system.health"] },
];

const initials = (u: DemoUser) =>
  u.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

function Avatar({ user, size = "md" }: { user: DemoUser; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full bg-blue-soft font-bold text-navy ${
        size === "lg" ? "size-11 text-lg" : "size-10"
      }`}
    >
      {initials(user)}
    </span>
  );
}

function Shell({ tabs, right }: { tabs?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="bg-navy text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pt-4 pb-2">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            Label Check
          </Link>
          {right}
        </div>
        <nav aria-label="Main" className="min-h-12">
          {tabs}
        </nav>
      </div>
    </header>
  );
}

/** What the header shows before the browser knows who's signed in. */
export function SiteHeaderShell() {
  return <Shell />;
}

export function SiteHeader() {
  const s = useDemo();
  const path = usePathname();
  const user = me(s);
  const tabs = TABS.filter((t) => t.needs.some((p) => can(s, user.id, p)));
  const isActive = (href: string) => path === href || (href === "/" && path === "/review");

  return (
    <Shell
      right={<UserSwitcher state={s} />}
      tabs={
        <ul className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={isActive(t.href) ? "page" : undefined}
                className={`block rounded-t-md px-3 py-3 font-semibold whitespace-nowrap sm:px-5 sm:text-lg ${
                  isActive(t.href) ? "bg-page text-navy" : "text-white hover:bg-white/10"
                }`}
              >
                {t.label(s)}
              </Link>
            </li>
          ))}
        </ul>
      }
    />
  );
}

/**
 * The demo's sign-in. Each person shows their role and what it lets them
 * do, so switching is also the quickest way to see what each role sees.
 */
function UserSwitcher({ state: s }: { state: DemoState }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const panel = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const user = me(s);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function signIn(u: DemoUser) {
    setOpen(false);
    if (u.id === user.id) return;
    dispatch({ type: "sign-in", userId: u.id });
    router.push(homeFor({ ...s, currentUser: u.id }, u.id));
  }

  return (
    <div ref={box} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-3 rounded-md border-2 border-white/40 py-1.5 pr-4 pl-1.5 text-left hover:bg-white/10"
      >
        <Avatar user={user} />
        <span>
          <span className="block text-sm text-white/80">Signed in as</span>
          <span className="block leading-tight font-semibold">
            {user.name}, {ROLES[user.role].label}
          </span>
        </span>
        <span className="ml-2 shrink-0 rounded bg-white px-2.5 py-1 text-sm font-bold whitespace-nowrap text-navy">
          Switch user
        </span>
      </button>

      {open && (
        <div
          id={panel}
          className="absolute right-0 z-20 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-lg bg-white p-2 text-ink shadow-lg ring-1 ring-line"
        >
          <p className="px-3 pt-2 pb-1 text-muted">
            Sign in as someone else to see what their role can see and do.
          </p>
          <ul>
            {s.users.map((u) => {
              const current = u.id === user.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    disabled={!u.active}
                    aria-current={current ? "true" : undefined}
                    onClick={() => signIn(u)}
                    className={`flex w-full items-start gap-3 rounded-md px-3 py-3 text-left disabled:opacity-60 ${
                      current ? "bg-blue-soft" : "hover:bg-page"
                    }`}
                  >
                    <Avatar user={u} size="lg" />
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {u.name}
                        {current && <span className="font-normal text-muted"> (you)</span>}
                      </span>
                      <span className="block text-sm font-semibold text-blue-dark">
                        {ROLES[u.role].label}
                        {u.active ? "" : ", deactivated"}
                      </span>
                      <span className="block text-sm text-muted">{ROLES[u.role].does}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line-soft px-3 pt-2 pb-1 text-sm text-muted">
            A demo sign-in with no passwords. In production this is single sign-on, and the server checks
            every permission.
          </p>
        </div>
      )}
    </div>
  );
}

export function DemoBanner() {
  const s = useDemo();
  if (s.bannerDismissed) return null;
  const user = me(s);
  return (
    <div className="border-b border-line bg-blue-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="max-w-4xl">
          This is a demo with made-up applications. You&apos;re signed in as{" "}
          <strong className="font-semibold">{user.name}</strong>, {user.role === "agent" ? "an" : "a"}{" "}
          {ROLES[user.role].label.toLowerCase()}. Each role sees and does different things: use{" "}
          <strong className="font-semibold">Switch user</strong> at the top right to try them.
        </p>
        <button
          type="button"
          onClick={() => dispatch({ type: "dismiss-banner" })}
          className="rounded-md border-2 border-blue bg-white px-4 py-1.5 font-semibold text-blue hover:bg-blue-soft"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
