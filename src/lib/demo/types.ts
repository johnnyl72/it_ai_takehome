import type { Beverage, DemoUser, Permission, Role } from "./users";

/** COLAs Online's names for where an application is. */
export type AppStatus = "received" | "in-review" | "needs-correction" | "approved" | "rejected";
export type Decision = Extract<AppStatus, "needs-correction" | "approved" | "rejected">;

/** What the tool's own check said, before the agent decided. */
export type Precheck = "pass" | "review" | "fail" | "unreadable";

export interface DemoApplication {
  id: string;
  ttbId: string;
  /** The test-kit label file this application's image and details come from. */
  kitFile: string;
  brand: string;
  applicant: string;
  beverage: Beverage;
  receivedAt: number;
  assignee: string | null;
  status: AppStatus;
}

/** Who or what made an assignment. */
export type AssignedBy = "auto" | "balance" | string;

interface Base {
  id: number;
  at: number;
  /** A user id, or "system" for automatic work. */
  actor: string;
}

/** Events about an application carry its TTB ID and brand, so the log reads on its own. */
interface AppRef {
  appId: string;
  ttbId: string;
  brand: string;
}

export type DemoEvent = Base &
  (
    | { type: "signed-in" }
    | ({ type: "received" } & AppRef)
    | ({ type: "assigned"; to: string; from: string | null; by: AssignedBy } & AppRef)
    | ({ type: "opened" } & AppRef)
    | ({ type: "checked"; ms: number; outcome: Precheck | "error" } & AppRef)
    | ({ type: "decided"; decision: Decision; reason: string; precheck: Precheck | null } & AppRef)
    | { type: "role-changed"; userId: string; role: Role }
    | { type: "active-changed"; userId: string; active: boolean }
    | { type: "specialty-changed"; userId: string; specialty: Beverage | null }
    | { type: "permission-changed"; role: Role; permission: Permission; granted: boolean }
  );

export type EventOf<T extends DemoEvent["type"]> = Extract<DemoEvent, { type: T }>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before the log gives it an id (and, for the reducer, a time). */
export type NewEvent = DistributiveOmit<DemoEvent, "id">;
export type EventDraft = DistributiveOmit<DemoEvent, "id" | "at">;

export interface DemoState {
  version: number;
  seededAt: number;
  currentUser: string;
  users: DemoUser[];
  permissions: Record<Role, Permission[]>;
  applications: DemoApplication[];
  /** Append-only and the source of every number on the Team and health screens. */
  events: DemoEvent[];
  nextEventId: number;
  arrivals: number;
  bannerDismissed: boolean;
}

export const STATUS_LABEL: Record<AppStatus, string> = {
  received: "Received",
  "in-review": "In review",
  "needs-correction": "Needs correction",
  approved: "Approved",
  rejected: "Rejected",
};

export const isOpen = (s: AppStatus) => s === "received" || s === "in-review";
