import type { LabelReading } from "./ocr/types";

/** What the agent types in from the COLA application. Blank fields are skipped. */
export interface Application {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  bottler: string;
  countryOfOrigin: string;
}
export type ApplicationField = keyof Application;

export const EMPTY_APPLICATION: Application = {
  brandName: "",
  classType: "",
  alcoholContent: "",
  netContents: "",
  bottler: "",
  countryOfOrigin: "",
};

/**
 * pass: matches, possibly with a harmless difference the note explains.
 * review: the tool can't be sure; the agent decides.
 * fail: a real mismatch or a missing requirement.
 * skipped: the application left this field blank.
 */
export type Status = "pass" | "review" | "fail" | "skipped";

export interface WordDiff {
  /** misread: the label word differs from the required one only by lookalike characters. */
  op: "same" | "missing" | "extra" | "misread";
  text: string;
  /** misread only: the required word it was probably meant to be. */
  expected?: string;
}

export interface Check {
  id: ApplicationField | "governmentWarning";
  label: string;
  status: Status;
  expected: string | null;
  found: string | null;
  note: string;
  /** Government warning only: one line per rule (caps, wording, bold). */
  details?: { status: Status; text: string }[];
  diff?: WordDiff[];
}

export interface VerificationResult {
  verdict: Exclude<Status, "skipped">;
  headline: string;
  checks: Check[];
  imageNote: string | null;
  /** What was read, kept small: a batch holds hundreds of these. */
  reading: Pick<LabelReading, "lines" | "meanConfidence" | "imageQuality" | "straightenedBy">;
  timing: { totalMs: number; readMs: number };
  engine: string;
}
