import type { DemoApplication } from "./types";
import type { Beverage, DemoUser } from "./users";

/**
 * How far above the least-loaded agent a specialist may be and still get
 * their kind of label. Without a limit, the spirits specialist would get
 * every bourbon on a busy day while everyone else waits.
 */
export const SPECIALTY_SLACK = 2;

type Agent = Pick<DemoUser, "id" | "name" | "specialty">;

const byLoadThenName = (load: Map<string, number>) => (a: Agent, b: Agent) =>
  (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0) || a.name.localeCompare(b.name);

/** The least-loaded agent, preferring a specialist in this beverage within the slack. */
export function pickAgent(beverage: Beverage, agents: Agent[], load: Map<string, number>): string | null {
  if (!agents.length) return null;
  const sorted = [...agents].sort(byLoadThenName(load));
  const least = load.get(sorted[0].id) ?? 0;
  const specialist = sorted.find(
    (a) => a.specialty === beverage && (load.get(a.id) ?? 0) <= least + SPECIALTY_SLACK,
  );
  return (specialist ?? sorted[0]).id;
}

/** Open applications per agent: the work that's theirs and not finished. */
export function openLoad(apps: DemoApplication[], agents: Agent[]): Map<string, number> {
  const load = new Map(agents.map((a) => [a.id, 0]));
  for (const app of apps) {
    if ((app.status === "received" || app.status === "in-review") && app.assignee && load.has(app.assignee)) {
      load.set(app.assignee, load.get(app.assignee)! + 1);
    }
  }
  return load;
}

/**
 * Evens out the queues with as few moves as possible: unassigned work is
 * dealt first, then unstarted work moves from the busiest agent to the least
 * busy until no one has more than one more open application than anyone else.
 * Work already in review stays with whoever opened it. Returns each moved
 * application once, with where it ends up.
 */
export function balance(apps: DemoApplication[], agents: Agent[]): { appId: string; to: string }[] {
  const ids = new Set(agents.map((a) => a.id));
  const load = openLoad(apps, agents);
  const owner = new Map(apps.map((a) => [a.id, a.assignee]));
  const moved = new Map<string, string>();
  const give = (app: DemoApplication, to: string) => {
    const from = owner.get(app.id);
    if (from && load.has(from)) load.set(from, load.get(from)! - 1);
    load.set(to, (load.get(to) ?? 0) + 1);
    owner.set(app.id, to);
    if (to === app.assignee) moved.delete(app.id);
    else moved.set(app.id, to);
  };

  const received = apps
    .filter((a) => a.status === "received")
    .sort((a, b) => a.receivedAt - b.receivedAt || a.id.localeCompare(b.id));
  for (const app of received) {
    if (app.assignee && ids.has(app.assignee)) continue;
    const to = pickAgent(app.beverage, agents, load);
    if (to) give(app, to);
  }

  for (;;) {
    const sorted = [...agents].sort(byLoadThenName(load));
    if (sorted.length < 2) break;
    const low = sorted[0];
    // The busiest agent who still has unstarted work to give away.
    const high = [...sorted]
      .reverse()
      .find((a) => received.some((x) => owner.get(x.id) === a.id) && load.get(a.id)! - load.get(low.id)! > 1);
    if (!high) break;
    // Anyone at least two below them can take one. A match of label and
    // specialty goes first; otherwise their newest goes to the least busy.
    const receivers = sorted.filter((a) => load.get(high.id)! - load.get(a.id)! > 1);
    const theirs = received.filter((x) => owner.get(x.id) === high.id).reverse();
    const match = theirs
      .map((x) => [x, receivers.find((r) => r.specialty === x.beverage)] as const)
      .find(([, r]) => r);
    if (match) give(match[0], match[1]!.id);
    else give(theirs[0], receivers[0].id);
  }
  return [...moved].map(([appId, to]) => ({ appId, to }));
}
