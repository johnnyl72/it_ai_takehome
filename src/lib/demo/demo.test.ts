import { describe, expect, it } from "vitest";
import { balance, pickAgent } from "./assign";
import { agentWeek, health, overrides, percentile, workTimes } from "./metrics";
import { DAY, MINUTE, QUEUE_KIT, seed } from "./seed";
import { blocked, can, MAX_EVENTS, reduce, type DemoAction } from "./store";
import type { DemoApplication, DemoEvent, DemoState } from "./types";

const NOW = new Date(2026, 9, 28, 10, 30).getTime();
const as = (s: DemoState, userId: string): DemoState => ({ ...s, currentUser: userId });
const run = (s: DemoState, ...actions: DemoAction[]) => actions.reduce((st, a) => reduce(st, a, NOW), s);

describe("seed", () => {
  it("puts every kit label with an application and an image in the queue once", () => {
    const s = seed(NOW);
    expect(QUEUE_KIT.map((e) => e.file.slice(0, 2))).toEqual(
      Array.from({ length: 21 }, (_, i) => String(i + 1).padStart(2, "0")),
    );
    expect(s.applications).toHaveLength(21);
    expect(new Set(s.applications.map((a) => a.ttbId)).size).toBe(21);
    expect(s.applications.every((a) => a.ttbId.length === 14 && a.assignee)).toBe(true);
  });

  it("only seeds decisions the answer key agrees with", () => {
    const s = seed(NOW);
    const done = s.applications.filter((a) => a.status !== "received");
    expect(done.map((a) => [a.kitFile.slice(0, 2), a.status])).toEqual([
      ["01", "approved"],
      ["03", "approved"],
      ["11", "needs-correction"],
    ]);
  });

  it("makes the same history every time", () => {
    const a = seed(NOW);
    const b = seed(NOW);
    expect(a.events).toEqual(b.events);
    expect(a.events.length).toBeGreaterThan(300);
    expect(a.events.length).toBeLessThan(MAX_EVENTS);
    expect(a.events.every((e) => e.at <= NOW)).toBe(true);
  });
});

describe("permissions", () => {
  it("follows the role, and a deactivated user has none", () => {
    let s = seed(NOW);
    expect(can(s, "dave", "queue.own")).toBe(true);
    expect(can(s, "dave", "queue.team")).toBe(false);
    expect(can(s, "sarah", "team.monitor")).toBe(true);
    s = run(as(s, "marcus"), { type: "set-active", userId: "dave", active: false });
    expect(can(s, "dave", "queue.own")).toBe(false);
  });

  it("refuses what the actor's role doesn't allow, even if a screen sent it", () => {
    const s = seed(NOW);
    const app = s.applications.find((a) => a.assignee === "jenny" && a.status === "received")!;
    expect(blocked(s, { type: "reassign", appId: app.id, to: "dave" })).toMatch(/can't reassign/);
    expect(blocked(s, { type: "toggle-permission", role: "agent", permission: "check.batch" })).toMatch(
      /admin/,
    );
    expect(reduce(s, { type: "balance" }, NOW)).toBe(s);
  });

  it("can't lock everyone out of admin", () => {
    const s = as(seed(NOW), "marcus");
    expect(blocked(s, { type: "toggle-permission", role: "admin", permission: "admin" })).toMatch(
      /always keeps/,
    );
    expect(blocked(s, { type: "set-active", userId: "marcus", active: false })).toMatch(/yourself/);
    expect(blocked(s, { type: "set-role", userId: "marcus", role: "agent" })).toMatch(/own role/);
    // Another admin can't demote the last one either.
    const two = run(s, { type: "set-role", userId: "sarah", role: "admin" });
    const asSarah = as(run(two, { type: "set-active", userId: "sarah", active: true }), "sarah");
    expect(blocked(asSarah, { type: "set-role", userId: "marcus", role: "agent" })).toBeNull();
    const demoted = run(asSarah, { type: "set-role", userId: "marcus", role: "agent" });
    expect(blocked(demoted, { type: "set-role", userId: "sarah", role: "agent" })).toMatch(/own role/);
  });
});

describe("reduce", () => {
  it("moves an application through review to a decision, with a history", () => {
    let s = seed(NOW);
    const app = s.applications.find((a) => a.assignee === "dave" && a.status === "received")!;
    s = run(s, { type: "open", appId: app.id });
    expect(s.applications.find((a) => a.id === app.id)!.status).toBe("in-review");
    const refused = {
      type: "decide",
      appId: app.id,
      decision: "needs-correction",
      reason: " ",
      precheck: "fail",
    } as const;
    expect(blocked(s, refused)).toMatch(/fix/);
    s = run(s, { ...refused, reason: "Net contents don't match." });
    expect(s.applications.find((a) => a.id === app.id)!.status).toBe("needs-correction");
    const last = s.events.at(-1)!;
    expect(last).toMatchObject({
      type: "decided",
      actor: "dave",
      appId: app.id,
      reason: "Net contents don't match.",
    });
  });

  it("asks for a reason to approve against a problem", () => {
    const s = seed(NOW);
    const app = s.applications.find((a) => a.assignee === "dave" && a.status === "received")!;
    const approve = {
      type: "decide",
      appId: app.id,
      decision: "approved",
      reason: "",
      precheck: "fail",
    } as const;
    expect(blocked(s, approve)).toMatch(/approving it anyway/);
    expect(blocked(s, { ...approve, precheck: "pass" })).toBeNull();
  });

  it("only lets an agent open their own applications", () => {
    const s = seed(NOW);
    const other = s.applications.find((a) => a.assignee === "jenny")!;
    expect(blocked(s, { type: "open", appId: other.id })).toMatch(/isn't in your queue/);
    expect(blocked(as(s, "sarah"), { type: "open", appId: other.id })).toBeNull();
  });

  it("reassigns a deactivated agent's open work", () => {
    let s = as(seed(NOW), "marcus");
    s = run(s, { type: "set-active", userId: "janet", active: false });
    expect(s.applications.some((a) => a.assignee === "janet" && a.status === "received")).toBe(false);
    expect(s.events.filter((e) => e.type === "assigned" && e.at === NOW).length).toBeGreaterThan(0);
  });

  it("auto-assigns new arrivals and logs who got each one", () => {
    const s = run(as(seed(NOW), "sarah"), { type: "arrive", count: 5 });
    const fresh = s.applications.filter((a) => a.id.startsWith("n"));
    expect(fresh).toHaveLength(5);
    expect(new Set(fresh.map((a) => a.ttbId)).size).toBe(5);
    expect(fresh.every((a) => a.assignee)).toBe(true);
    expect(s.events.filter((e) => e.type === "assigned" && e.by === "auto" && e.at === NOW)).toHaveLength(5);
  });

  it("caps the event log", () => {
    let s = as(seed(NOW), "sarah");
    for (let i = 0; i < 600; i++) s = reduce(s, { type: "arrive", count: 1 }, NOW);
    expect(s.events.length).toBe(MAX_EVENTS);
    expect(s.events.at(-1)!.id).toBe(s.nextEventId - 1);
  });
});

describe("assignment", () => {
  const agents = [
    { id: "dave", name: "Dave", specialty: "spirits" as const },
    { id: "jenny", name: "Jenny", specialty: null },
    { id: "janet", name: "Janet", specialty: "wine" as const },
  ];
  const load = (d: number, je: number, ja: number) =>
    new Map([
      ["dave", d],
      ["jenny", je],
      ["janet", ja],
    ]);

  it("prefers a specialist within the slack, then the least loaded", () => {
    expect(pickAgent("spirits", agents, load(2, 0, 1))).toBe("dave");
    expect(pickAgent("spirits", agents, load(3, 0, 1))).toBe("jenny");
    expect(pickAgent("beer", agents, load(1, 1, 1))).toBe("dave");
    expect(pickAgent("wine", agents, load(0, 0, 0))).toBe("janet");
    expect(pickAgent("wine", [], load(0, 0, 0))).toBeNull();
  });

  const app = (id: string, assignee: string | null, status: DemoApplication["status"]): DemoApplication => ({
    id,
    ttbId: id,
    kitFile: "",
    brand: id,
    applicant: "",
    beverage: id === "a5" ? "wine" : "spirits",
    receivedAt: Number(id.slice(1)),
    assignee,
    status,
  });

  it("evens out the queues with as few moves as possible, leaving work in review", () => {
    const apps = [
      app("a1", "dave", "in-review"),
      app("a2", "dave", "received"),
      app("a3", "dave", "received"),
      app("a4", "dave", "received"),
      app("a5", "dave", "received"),
      app("a6", null, "received"),
    ];
    const moves = balance(apps, agents);
    expect(moves.some((m) => m.appId === "a1")).toBe(false);
    // 6 open between 3 agents: 2 each, so 4 moves (one is the unassigned one).
    expect(moves).toHaveLength(4);
    // The wine label goes to the wine specialist.
    expect(moves.find((m) => m.appId === "a5")?.to).toBe("janet");
    expect(balance(apps, agents)).toEqual(moves);
  });

  it("moves nothing when the queues are already even", () => {
    const apps = [
      app("a1", "dave", "received"),
      app("a2", "jenny", "received"),
      app("a3", "janet", "received"),
      app("a4", "dave", "received"),
    ];
    expect(balance(apps, agents)).toEqual([]);
  });
});

describe("metrics", () => {
  const ref = { appId: "x1", ttbId: "1", brand: "X" };
  const ev = (e: Partial<DemoEvent> & Pick<DemoEvent, "type">, id: number, at: number) =>
    ({ actor: "dave", ...ref, ...e, id, at }) as DemoEvent;

  it("times each decision from the decider's last opening", () => {
    const events = [
      ev({ type: "opened" }, 1, NOW - 30 * MINUTE),
      ev({ type: "opened" }, 2, NOW - 10 * MINUTE),
      ev({ type: "opened", actor: "sarah" } as Partial<DemoEvent> & { type: "opened" }, 3, NOW - 5 * MINUTE),
      ev({ type: "decided", decision: "approved", reason: "", precheck: "pass" } as never, 4, NOW),
    ];
    expect(workTimes(events).get(4)).toBe(10 * MINUTE);
  });

  it("counts a week of decisions and spots overrides", () => {
    const s = {
      ...seed(NOW),
      events: [
        ev({ type: "opened" }, 1, NOW - 2 * DAY - 4 * MINUTE),
        ev(
          { type: "decided", decision: "approved", reason: "Looked fine.", precheck: "fail" } as never,
          2,
          NOW - 2 * DAY,
        ),
        ev({ type: "opened" }, 3, NOW - 9 * DAY),
        ev(
          { type: "decided", decision: "rejected", reason: "Old.", precheck: "fail" } as never,
          4,
          NOW - 9 * DAY,
        ),
      ],
    };
    const week = agentWeek(s, "dave", NOW);
    expect(week).toMatchObject({ finished: 1, approved: 1, overrides: 1, medianMs: 4 * MINUTE });
    expect(overrides(s, NOW).map((e) => e.id)).toEqual([2]);
  });

  it("reports check times against the 5 s target", () => {
    const checks = [900, 1200, 1300, 1500, 6000].map((ms, i) =>
      ev(
        { type: "checked", actor: "system", ms, outcome: i === 0 ? "unreadable" : "pass" } as never,
        i + 1,
        NOW - i * MINUTE,
      ),
    );
    const h = health(
      {
        ...seed(NOW),
        events: [...checks, ev({ type: "checked", ms: 0, outcome: "error" } as never, 9, NOW)],
      },
      NOW,
    );
    expect(h).toMatchObject({
      checks: 6,
      medianMs: 1300,
      p95Ms: 6000,
      overTarget: 1,
      unreadable: 1,
      errors: 1,
    });
    expect(percentile([], 95)).toBeNull();
  });
});
