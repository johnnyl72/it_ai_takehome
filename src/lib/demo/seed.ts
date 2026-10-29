/**
 * The demo's starting state: a queue built from the test kit, and two weeks
 * of made-up history so the Team and health screens have something to show
 * on a first visit. A fixed-seed generator makes every demo look the same.
 */
import { TEST_KIT, type KitEntry } from "../samples";
import { pickAgent } from "./assign";
import type {
  ClearedEntry,
  DayTotals,
  Decision,
  DemoApplication,
  DemoEvent,
  DemoState,
  NewEvent,
  Precheck,
} from "./types";
import { beverageOf, DEFAULT_PERMISSIONS, DEMO_USERS, type Beverage } from "./users";

export const SPOT_CHECK_WHY = "Spot check: the automatic check cleared it. Confirm it's right.";

export const DEMO_VERSION = 2;

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** The kit labels that come with an application and an image: files 01 to 21. */
export const QUEUE_KIT: KitEntry[] = TEST_KIT.filter((e) => e.hasImage && e.csvName && !e.copyOf);

/** What the answer key says the automatic check finds for a kit label. */
export const KIT_VERDICT = (e: KitEntry): Precheck =>
  e.expected === "Match"
    ? "pass"
    : e.expected === "Review"
      ? "review"
      : e.expected === "Problem"
        ? "fail"
        : "unreadable";

export const kitEntry = (file: string) => TEST_KIT.find((e) => e.file === file);

/** A plausible 14-digit TTB ID: year, day of the year, then a serial. */
export function ttbId(at: number, serial: number): string {
  const d = new Date(at);
  const doy = Math.floor((at - new Date(d.getFullYear(), 0, 0).getTime()) / DAY);
  return `${String(d.getFullYear()).slice(2)}${String(doy).padStart(3, "0")}001${String(serial).padStart(6, "0")}`;
}

export function applicationFrom(
  entry: KitEntry,
  id: string,
  receivedAt: number,
  serial: number,
): DemoApplication {
  const a = entry.sample.application;
  return {
    id,
    ttbId: ttbId(receivedAt, serial),
    kitFile: entry.file,
    brand: a.brandName,
    applicant: a.bottler.split(",")[0],
    beverage: beverageOf(a.classType),
    receivedAt,
    assignee: null,
    status: "received",
    verdict: null,
    why: "",
    spotCheck: false,
  };
}

/** Kit labels that start out finished, with the result the answer key gives them. */
const SEEDED_DECISIONS: Record<string, { decision: Decision; precheck: Precheck; reason: string }> = {
  "02-stones-throw-gin.jpg": { decision: "approved", precheck: "pass", reason: "" },
  "11-harbor-light-rum.jpg": {
    decision: "needs-correction",
    precheck: "fail",
    reason: "Government warning: the heading is in title case, not capitals.",
  },
};

/** mulberry32: small, fast and the same on every machine. */
function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PACE: Record<string, { perDay: [number, number]; minutes: number; overrides: number }> = {
  dave: { perDay: [9, 13], minutes: 4.2, overrides: 0.01 },
  jenny: { perDay: [12, 17], minutes: 2.6, overrides: 0.04 },
  janet: { perDay: [8, 12], minutes: 3.4, overrides: 0.08 },
};

const REASONS: Record<"fail" | "review" | "reject" | "caught", string[]> = {
  fail: [
    "Government warning: the heading isn't in capitals.",
    "Net contents don't match the application.",
    "Brand name doesn't match the application.",
    "Alcohol content doesn't match the application.",
    "Government warning is reworded.",
    "Country of origin is missing on an import.",
  ],
  review: [
    "Government warning print is too small.",
    "Bottler's city differs from the application.",
    "Photo too blurry to confirm the warning. Ask for a clearer image.",
  ],
  reject: ["Government warning is missing.", "Alcohol content and proof disagree."],
  caught: ["Fanciful name on the label isn't on the application.", "Label shows a health claim."],
};
const OVERRIDE_APPROVALS = [
  "Checked by eye: the reader misread a word, and the label is correct.",
  "Checked the warning by eye at full size: it's correct.",
];
const ADJECTIVES = [
  "Copper",
  "Silver",
  "Old",
  "Blue",
  "Red",
  "Black",
  "Golden",
  "Stone",
  "High",
  "Wild",
  "North",
];
const NOUNS = [
  "Creek",
  "Ridge",
  "Barrel",
  "Hollow",
  "Gate",
  "Point",
  "Field",
  "Harbor",
  "Mill",
  "Valley",
  "Grove",
];

/** Made-up finished work for the last two weeks, per agent, on weekdays. */
function history(seededAt: number, push: (e: NewEvent) => void) {
  const rnd = random(20261028);
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const normal = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  let serial = 100000;

  for (let back = 14; back >= 0; back--) {
    const day = new Date(seededAt);
    day.setDate(day.getDate() - back);
    if (day.getDay() === 0 || day.getDay() === 6) continue;
    day.setHours(8, 0, 0, 0);
    const end = Math.min(day.getTime() + 8.5 * HOUR, seededAt);

    for (const [actor, pace] of Object.entries(PACE)) {
      const count = pace.perDay[0] + Math.floor(rnd() * (pace.perDay[1] - pace.perDay[0] + 1));
      let t = day.getTime() + rnd() * 20 * MINUTE;
      for (let n = 0; n < count && t < end; n++) {
        const ref = {
          appId: `h${serial}`,
          ttbId: ttbId(t, serial),
          brand: `${pick(ADJECTIVES)} ${pick(NOUNS)}`,
        };
        serial++;
        const r = rnd();
        const precheck: Precheck = r < 0.55 ? "pass" : r < 0.77 ? "review" : r < 0.97 ? "fail" : "unreadable";
        const ms = Math.round(rnd() < 0.02 ? 4500 + rnd() * 2500 : 1400 * Math.exp(0.3 * normal()));
        const worked = pace.minutes * MINUTE * Math.exp(0.45 * normal());
        if (t + worked > end) break;

        let decision: Decision;
        let reason = "";
        const override = rnd() < pace.overrides;
        if (precheck === "pass") {
          decision = override ? "needs-correction" : "approved";
          if (override) reason = pick(REASONS.caught);
        } else if (precheck === "review") {
          const d = rnd();
          decision = d < 0.55 ? "approved" : d < 0.95 ? "needs-correction" : "rejected";
          if (decision !== "approved")
            reason = pick(decision === "rejected" ? REASONS.reject : REASONS.review);
        } else if (override) {
          decision = "approved";
          reason = pick(OVERRIDE_APPROVALS);
        } else if (precheck === "unreadable") {
          decision = "needs-correction";
          reason = "Ask for an image at least 1500 pixels on its long side.";
        } else {
          decision = rnd() < 0.78 ? "needs-correction" : "rejected";
          reason = pick(decision === "rejected" ? REASONS.reject : REASONS.fail);
        }

        push({ type: "opened", at: t, actor, ...ref });
        push({ type: "checked", at: t + 500, actor: "system", ms, outcome: precheck, ...ref });
        push({ type: "decided", at: t + worked, actor, decision, reason, precheck, ...ref });
        t += worked + (1 + rnd() * 6) * MINUTE;
      }
    }
  }
}

/** Clean matches that start out already cleared, and the two sent to a person as spot checks. */
const CLEARED_KIT = new Set([
  "01-old-tom-bourbon.jpg",
  "03-chateau-marcel-wine.jpg",
  "04-vino-del-sol-wine.jpg",
  "06-trailhead-ipa-photo.jpg",
]);

/**
 * Two weeks of TTB-wide daily totals. 150,000 applications a year is about
 * 600 a working day; filings keep coming at weekends, when only the
 * automatic checks are working. One day has an importer's batch on top.
 */
function days(now: number): DayTotals[] {
  const rnd = random(150000);
  const today = new Date(now);
  const elapsed = (today.getHours() * 60 + today.getMinutes()) / (24 * 60);
  const worked = Math.min(1, Math.max(0, (today.getHours() + today.getMinutes() / 60 - 8) / 8.5));
  const out: DayTotals[] = [];
  for (let back = 13; back >= 0; back--) {
    const d = new Date(now);
    d.setDate(d.getDate() - back);
    d.setHours(0, 0, 0, 0);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    let received = weekend ? 60 + Math.floor(rnd() * 80) : 520 + Math.floor(rnd() * 200);
    if (!weekend && back === 3) received += 280;
    const share = back === 0 ? elapsed : 1;
    received = Math.round(received * share);
    const cleared = Math.round(received * (0.66 + rnd() * 0.08));
    const flagged = received - cleared;
    const spotChecks = Math.round(cleared / 20);
    const unreadable = Math.round(flagged * 0.05);
    const review = Math.round(flagged * (0.42 + rnd() * 0.08));
    const finished = weekend
      ? 0
      : Math.round((flagged + spotChecks) * (0.9 + rnd() * 0.2) * (back === 0 ? worked : 1));
    out.push({
      day: d.getTime(),
      received,
      cleared,
      flagged,
      review,
      problem: flagged - review - unreadable,
      unreadable,
      spotChecks,
      finished,
    });
  }
  return out;
}

/** The latest clearances, so the Cleared table isn't empty before the first live check. */
function recentClearances(now: number): ClearedEntry[] {
  const rnd = random(4242);
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const kinds: [Beverage, string][] = [
    ["spirits", "Distilling"],
    ["spirits", "Spirits"],
    ["wine", "Cellars"],
    ["wine", "Imports"],
    ["beer", "Brewing Co."],
  ];
  return Array.from({ length: 40 }, (_, i) => {
    const [beverage, suffix] = pick(kinds);
    const brand = `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
    const at = now - (40 - i) * (2 + rnd() * 6) * MINUTE;
    return {
      at,
      ttbId: ttbId(at, 300000 + i),
      brand,
      beverage,
      applicant: `${brand} ${suffix}`,
      ms: Math.round(1300 * Math.exp(0.25 * (rnd() - 0.5))),
    };
  }).sort((a, b) => a.at - b.at);
}

export function seed(now: number): DemoState {
  const events: DemoEvent[] = [];
  const push = (e: NewEvent) => events.push({ ...e, id: 0 } as DemoEvent);

  history(now, push);

  const agents = DEMO_USERS.filter((u) => u.active && DEFAULT_PERMISSIONS[u.role].includes("queue.own"));
  const load = new Map(agents.map((a) => [a.id, 0]));
  // Everything the automatic check couldn't clear, plus two spot checks of clean matches.
  const applications = QUEUE_KIT.filter((e) => !CLEARED_KIT.has(e.file)).map((entry, i) => {
    const app = applicationFrom(
      entry,
      `a${String(i + 1).padStart(2, "0")}`,
      now - ((i % 4) + 1) * DAY - ((i * 47) % 360) * MINUTE,
      i + 1,
    );
    app.verdict = KIT_VERDICT(entry);
    app.spotCheck = app.verdict === "pass";
    app.why = app.spotCheck ? SPOT_CHECK_WHY : entry.answer;
    return app;
  });
  for (const app of [...applications].sort((a, b) => a.receivedAt - b.receivedAt)) {
    const ref = { appId: app.id, ttbId: app.ttbId, brand: app.brand };
    const to = pickAgent(app.beverage, agents, load)!;
    app.assignee = to;
    push({ type: "received", at: app.receivedAt, actor: "system", ...ref });
    push({ type: "checked", at: app.receivedAt, actor: "system", ms: 1300, outcome: app.verdict!, ...ref });
    push({ type: "assigned", at: app.receivedAt, actor: "system", to, from: null, by: "auto", ...ref });

    const done = SEEDED_DECISIONS[app.kitFile];
    if (done) {
      const opened = app.receivedAt + 3 * HOUR;
      push({ type: "opened", at: opened, actor: to, ...ref });
      push({ type: "decided", at: opened + 4 * MINUTE, actor: to, ...done, ...ref });
      app.status = done.decision;
    } else {
      load.set(to, load.get(to)! + 1);
    }
  }

  events.sort((a, b) => a.at - b.at);
  events.forEach((e, i) => (e.id = i + 1));
  return {
    version: DEMO_VERSION,
    seededAt: now,
    currentUser: "dave",
    users: DEMO_USERS.map((u) => ({ ...u })),
    permissions: structuredClone(DEFAULT_PERMISSIONS),
    applications,
    events,
    nextEventId: events.length + 1,
    automation: { running: true, autoClear: true, sampleEvery: 20, processed: 0, backlog: 0, recentMs: [] },
    days: days(now),
    cleared: recentClearances(now),
    bannerDismissed: false,
  };
}
