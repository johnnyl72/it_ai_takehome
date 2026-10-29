"use client";

import { useDemo } from "@/lib/client/demo";
import { can, me } from "@/lib/demo/store";
import { ROLES, type Permission } from "@/lib/demo/users";

/** Shown while the browser loads the demo's sign-in; it never shows for long. */
export function PageLoading() {
  return <p className="text-lg text-muted">Loading…</p>;
}

export function NoAccess({ what }: { what: string }) {
  const s = useDemo();
  const user = me(s);
  return (
    <div
      role="alert"
      className="max-w-2xl rounded-lg border-l-8 border-review bg-white p-6 shadow-sm ring-1 ring-line-soft"
    >
      <h1 className="text-2xl font-bold text-navy">Your role doesn&apos;t include {what}</h1>
      <p className="mt-2 text-lg">
        You&apos;re signed in as {user.name}, {ROLES[user.role].label}. Ask your system admin to change your
        role, or use <strong className="font-semibold">Switch user</strong> at the top right.
      </p>
    </div>
  );
}

/** Renders its children only for a role with one of these permissions. */
export function Gate({
  anyOf,
  what,
  children,
}: {
  anyOf: Permission[];
  what: string;
  children: React.ReactNode;
}) {
  const s = useDemo();
  return anyOf.some((p) => can(s, s.currentUser, p)) ? children : <NoAccess what={what} />;
}
