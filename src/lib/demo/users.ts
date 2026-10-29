/**
 * The demo's people and roles. The people are the ones from the discovery
 * interviews, so a reviewer can switch between the views they asked for.
 * Access is role-based: a user has one role, and a role is a list of
 * permissions the system admin can change.
 */

export type Role = "agent" | "supervisor" | "admin";

export type Permission =
  | "queue.own"
  | "queue.team"
  | "team.monitor"
  | "stats.own"
  | "system.health"
  | "decide"
  | "check.single"
  | "check.batch"
  | "ocr.text"
  | "admin";

export type Beverage = "spirits" | "wine" | "beer";

export interface DemoUser {
  id: string;
  name: string;
  title: string;
  role: Role;
  active: boolean;
  /** Auto-assignment prefers an agent whose specialty matches the label. */
  specialty: Beverage | null;
}

export const ROLES: Record<Role, { label: string; does: string }> = {
  agent: { label: "Agent", does: "Works their own queue of applications and checks labels." },
  supervisor: {
    label: "Supervisor",
    does: "Sees every queue, assigns work and follows each agent's activity.",
  },
  admin: { label: "System admin", does: "Manages users and roles, and watches how the system runs." },
};

/** In display order, with the words the admin screen uses. */
export const PERMISSIONS: { id: Permission; label: string; detail: string }[] = [
  { id: "queue.own", label: "Own queue", detail: "Gets applications assigned and works them." },
  { id: "queue.team", label: "Team queue", detail: "Sees every queue and reassigns work." },
  { id: "team.monitor", label: "Team page", detail: "Sees each agent's workload, pace and activity." },
  { id: "stats.own", label: "Own numbers", detail: "Sees their own week on the queue page." },
  { id: "decide", label: "Record decisions", detail: "Approves, sends back or rejects an application." },
  { id: "check.single", label: "Check a label", detail: "Checks one label typed in by hand." },
  { id: "check.batch", label: "Check a batch", detail: "Checks a folder of labels against a CSV." },
  { id: "ocr.text", label: "Text read from labels", detail: "Sees every line the reader found." },
  { id: "system.health", label: "System health", detail: "Sees check times and error rates." },
  { id: "admin", label: "Manage users and roles", detail: "Changes roles, permissions and users." },
];

export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  agent: ["queue.own", "stats.own", "decide", "check.single", "check.batch", "ocr.text"],
  supervisor: [
    "queue.team",
    "team.monitor",
    "stats.own",
    "decide",
    "check.single",
    "check.batch",
    "ocr.text",
  ],
  admin: ["system.health", "admin"],
};

export const DEMO_USERS: DemoUser[] = [
  {
    id: "dave",
    name: "Dave Morrison",
    title: "Senior Compliance Agent",
    role: "agent",
    active: true,
    specialty: "spirits",
  },
  {
    id: "jenny",
    name: "Jenny Park",
    title: "Compliance Agent",
    role: "agent",
    active: true,
    specialty: null,
  },
  // The interviews give Janet no surname.
  {
    id: "janet",
    name: "Janet",
    title: "Compliance Agent, Seattle",
    role: "agent",
    active: true,
    specialty: "wine",
  },
  {
    id: "sarah",
    name: "Sarah Chen",
    title: "Deputy Director of Label Compliance",
    role: "supervisor",
    active: true,
    specialty: null,
  },
  {
    id: "marcus",
    name: "Marcus Williams",
    title: "IT Systems Administrator",
    role: "admin",
    active: true,
    specialty: null,
  },
];

export const BEVERAGES: Record<Beverage, string> = { spirits: "Spirits", wine: "Wine", beer: "Beer" };

export const beverageOf = (classType: string): Beverage =>
  /\bwine\b/i.test(classType)
    ? "wine"
    : /\b(ale|lager|beer|stout|porter)\b/i.test(classType)
      ? "beer"
      : "spirits";

export const firstName = (u: DemoUser) => u.name.split(" ")[0];
