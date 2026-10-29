import type { VerificationResult } from "../types";

/** What a check found that needs a person, one line per field, worst first. */
export function issues(result: VerificationResult): string[] {
  const rank = { fail: 0, review: 1, pass: 2, skipped: 3 };
  return result.checks
    .filter((c) => c.status === "fail" || c.status === "review")
    .sort((a, b) => rank[a.status] - rank[b.status])
    .map((c) =>
      c.details
        ? `${c.label}: ${c.details
            .filter((d) => d.status !== "pass")
            .map((d) => d.text)
            .join(" ")}`
        : `${c.label}: ${c.note}`,
    );
}
