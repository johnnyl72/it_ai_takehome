/**
 * Every change to the demo goes through `reduce`, which checks the actor's
 * permissions the way a server would and appends an event for each change.
 * The screens hide what a role can't do; this is what actually refuses it.
 */
import { balance, openLoad, pickAgent } from "./assign";
import { applicationFrom, QUEUE_KIT } from "./seed";
import type { Decision, DemoApplication, DemoEvent, DemoState, EventDraft, Precheck } from "./types";
import { isOpen } from "./types";
import { ROLES, type Beverage, type DemoUser, type Permission, type Role } from "./users";

/** About 300 KB of JSON at the cap; the oldest events go first. */
export const MAX_EVENTS = 2000;

export type DemoAction =
  | { type: "sign-in"; userId: string }
  | { type: "open"; appId: string }
  | { type: "checked"; appId: string; ms: number; outcome: Precheck | "error" }
  | { type: "decide"; appId: string; decision: Decision; reason: string; precheck: Precheck | null }
  | { type: "reassign"; appId: string; to: string }
  | { type: "balance" }
  | { type: "arrive"; count: number }
  | { type: "set-role"; userId: string; role: Role }
  | { type: "set-active"; userId: string; active: boolean }
  | { type: "set-specialty"; userId: string; specialty: Beverage | null }
  | { type: "toggle-permission"; role: Role; permission: Permission }
  | { type: "dismiss-banner" };

export const userById = (s: DemoState, id: string | null) => s.users.find((u) => u.id === id);
export const me = (s: DemoState) => userById(s, s.currentUser)!;

export function can(s: DemoState, userId: string, permission: Permission): boolean {
  const u = userById(s, userId);
  return !!u?.active && s.permissions[u.role].includes(permission);
}

/** Who auto-assignment deals work to: active users whose role has an own queue. */
export const assignable = (s: DemoState): DemoUser[] => s.users.filter((u) => can(s, u.id, "queue.own"));

/** Whether this user may see this application at all. */
export const canView = (s: DemoState, userId: string, app: DemoApplication) =>
  can(s, userId, "queue.team") || (can(s, userId, "queue.own") && app.assignee === userId);

/** A decision needs a reason unless it's an approval the pre-check agrees with. */
export const needsReason = (decision: Decision, precheck: Precheck | null) =>
  decision !== "approved" || precheck === "fail" || precheck === "unreadable";

const LOCKED = "The System admin role always keeps this, so someone can always manage users.";

/**
 * Why this action isn't allowed for the signed-in user, or null if it is.
 * The screens show these reasons next to a disabled control.
 */
export function blocked(s: DemoState, a: DemoAction): string | null {
  const actor = s.currentUser;
  const app = "appId" in a ? s.applications.find((x) => x.id === a.appId) : undefined;
  const admins = s.users.filter((u) => u.active && s.permissions[u.role].includes("admin"));
  switch (a.type) {
    case "sign-in":
      return userById(s, a.userId)?.active ? null : "This user is deactivated.";
    case "open":
      return app && canView(s, actor, app) ? null : "This application isn't in your queue.";
    case "checked":
      return app ? null : "No such application.";
    case "decide":
      if (!app || !isOpen(app.status)) return "This application already has a decision.";
      if (!can(s, actor, "decide")) return "Your role can't record decisions.";
      if (app.assignee !== actor && !can(s, actor, "queue.team"))
        return "This application is assigned to someone else.";
      if (needsReason(a.decision, a.precheck) && !a.reason.trim())
        return a.decision === "approved"
          ? "The pre-check found a problem. Say why you're approving it anyway."
          : "Say what the applicant needs to fix.";
      return null;
    case "reassign":
      if (!can(s, actor, "queue.team")) return "Your role can't reassign work.";
      if (!app || !isOpen(app.status)) return "Only open applications can be reassigned.";
      return assignable(s).some((u) => u.id === a.to) ? null : "That person doesn't take assigned work.";
    case "balance":
    case "arrive":
      return can(s, actor, "queue.team") ? null : "Your role can't assign work.";
    case "set-role":
      if (!can(s, actor, "admin")) return "Only a system admin can change roles.";
      if (a.userId === actor) return "You can't change your own role.";
      if (admins.length === 1 && admins[0].id === a.userId && !s.permissions[a.role].includes("admin"))
        return "This is the last admin. Make someone else an admin first.";
      return null;
    case "set-active":
      if (!can(s, actor, "admin")) return "Only a system admin can deactivate users.";
      if (a.userId === actor && !a.active) return "You can't deactivate yourself.";
      if (!a.active && admins.length === 1 && admins[0].id === a.userId)
        return "This is the last active admin.";
      return null;
    case "set-specialty":
      return can(s, actor, "admin") ? null : "Only a system admin can change specialties.";
    case "toggle-permission":
      if (!can(s, actor, "admin")) return "Only a system admin can change permissions.";
      if (a.role === "admin" && a.permission === "admin") return LOCKED;
      return null;
    case "dismiss-banner":
      return null;
  }
}

/** Gives open work whose assignee can no longer take it to someone who can. */
function reassignOrphans(s: DemoState, push: (e: EventDraft) => void) {
  const agents = assignable(s);
  const ids = new Set(agents.map((u) => u.id));
  const load = openLoad(s.applications, agents);
  s.applications = s.applications.map((app) => {
    if (!isOpen(app.status) || (app.assignee && ids.has(app.assignee))) return app;
    const to = pickAgent(app.beverage, agents, load);
    if (!to) return app;
    load.set(to, (load.get(to) ?? 0) + 1);
    push({ type: "assigned", actor: "system", to, from: app.assignee, by: "auto", ...ref(app) });
    return { ...app, assignee: to, status: "received" };
  });
}

const ref = (app: DemoApplication) => ({ appId: app.id, ttbId: app.ttbId, brand: app.brand });

export function reduce(state: DemoState, a: DemoAction, now: number): DemoState {
  if (blocked(state, a)) return state;
  const s: DemoState = { ...state, events: [...state.events] };
  const actor = state.currentUser;
  const push = (e: EventDraft) => {
    s.events.push({ ...e, id: s.nextEventId++, at: now } as DemoEvent);
  };
  const update = (id: string, patch: Partial<DemoApplication>) =>
    (s.applications = s.applications.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const app = "appId" in a ? state.applications.find((x) => x.id === a.appId)! : null;

  switch (a.type) {
    case "sign-in":
      s.currentUser = a.userId;
      push({ type: "signed-in", actor: a.userId });
      break;
    case "open":
      push({ type: "opened", actor, ...ref(app!) });
      if (app!.assignee === actor && app!.status === "received") update(app!.id, { status: "in-review" });
      break;
    case "checked":
      push({ type: "checked", actor: "system", ms: a.ms, outcome: a.outcome, ...ref(app!) });
      break;
    case "decide":
      push({
        type: "decided",
        actor,
        decision: a.decision,
        reason: a.reason.trim(),
        precheck: a.precheck,
        ...ref(app!),
      });
      update(app!.id, { status: a.decision });
      break;
    case "reassign":
      if (app!.assignee === a.to) return state;
      push({ type: "assigned", actor, to: a.to, from: app!.assignee, by: actor, ...ref(app!) });
      update(app!.id, { assignee: a.to, status: "received" });
      break;
    case "balance":
      for (const move of balance(s.applications, assignable(s))) {
        const moved = s.applications.find((x) => x.id === move.appId)!;
        push({ type: "assigned", actor, to: move.to, from: moved.assignee, by: "balance", ...ref(moved) });
        update(move.appId, { assignee: move.to });
      }
      break;
    case "arrive": {
      const agents = assignable(s);
      const load = openLoad(s.applications, agents);
      for (let i = 0; i < a.count; i++) {
        const n = s.arrivals++;
        // Steps through the kit by 8 so consecutive arrivals mix spirits, wine and beer.
        const entry = QUEUE_KIT[(n * 8) % QUEUE_KIT.length];
        const fresh = applicationFrom(entry, `n${n + 1}`, now, 500 + n);
        const to = pickAgent(fresh.beverage, agents, load);
        if (to) load.set(to, (load.get(to) ?? 0) + 1);
        s.applications = [...s.applications, { ...fresh, assignee: to }];
        push({ type: "received", actor: "system", ...ref(fresh) });
        if (to) push({ type: "assigned", actor: "system", to, from: null, by: "auto", ...ref(fresh) });
      }
      break;
    }
    case "set-role":
      s.users = s.users.map((u) => (u.id === a.userId ? { ...u, role: a.role } : u));
      push({ type: "role-changed", actor, userId: a.userId, role: a.role });
      reassignOrphans(s, push);
      break;
    case "set-active":
      s.users = s.users.map((u) => (u.id === a.userId ? { ...u, active: a.active } : u));
      push({ type: "active-changed", actor, userId: a.userId, active: a.active });
      reassignOrphans(s, push);
      break;
    case "set-specialty":
      s.users = s.users.map((u) => (u.id === a.userId ? { ...u, specialty: a.specialty } : u));
      push({ type: "specialty-changed", actor, userId: a.userId, specialty: a.specialty });
      break;
    case "toggle-permission": {
      const has = s.permissions[a.role].includes(a.permission);
      s.permissions = {
        ...s.permissions,
        [a.role]: has
          ? s.permissions[a.role].filter((p) => p !== a.permission)
          : [...s.permissions[a.role], a.permission],
      };
      push({ type: "permission-changed", actor, role: a.role, permission: a.permission, granted: !has });
      reassignOrphans(s, push);
      break;
    }
    case "dismiss-banner":
      s.bannerDismissed = true;
      break;
  }
  if (s.events.length > MAX_EVENTS) s.events = s.events.slice(-MAX_EVENTS);
  return s;
}

/** Where a user lands after signing in: the first screen their role can use. */
export function homeFor(s: DemoState, userId: string): string {
  if (can(s, userId, "queue.own") || can(s, userId, "queue.team")) return "/";
  if (can(s, userId, "admin") || can(s, userId, "system.health")) return "/admin";
  if (can(s, userId, "check.single")) return "/check";
  return "/";
}

export const roleLabel = (u: DemoUser) => ROLES[u.role].label;
