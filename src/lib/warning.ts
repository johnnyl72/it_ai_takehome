import { canonical, isLookalike, similarity } from "./normalize";
import type { WarningReading } from "./ocr/types";
import type { Check, Status, WordDiff } from "./types";
import { formatMl } from "./units";

/**
 * 27 CFR 16.21 sets the words; 16.22 sets the type: "GOVERNMENT WARNING" in
 * capitals and bold, the rest not bold, and a minimum height by container size.
 */
export const WARNING_HEADING = "GOVERNMENT WARNING:";
export const WARNING_BODY =
  "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";
export const WARNING_TEXT = `${WARNING_HEADING} ${WARNING_BODY}`;

const HEADING = /^\s*government\s+warning\s*(:?)/i;

/** Lowercased word with surrounding punctuation stripped; "(1)" stays "(1)". */
function wordKey(w: string): string {
  if (/^\(\d\)$/.test(w)) return w;
  return w.toLowerCase().replace(/^[^\p{L}\p{N}(]+|[^\p{L}\p{N})]+$/gu, "");
}

/**
 * Word-level diff (LCS). The warning is ~40 words, so O(n*m) is nothing.
 * `unsure` lists words the reader wasn't confident of; a swap involving one
 * of them counts as a misread rather than a rewording.
 */
export function diffWords(expected: string, found: string, unsure: string[] = []): WordDiff[] {
  const a = expected.split(" ").filter(Boolean);
  const b = found.split(" ").filter(Boolean);
  const ak = a.map(wordKey);
  const bk = b.map(wordKey);
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = ak[i] === bk[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: WordDiff[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && ak[i] === bk[j]) {
      out.push({ op: "same", text: b[j] });
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i][j + 1] >= lcs[i + 1][j])) {
      out.push({ op: "extra", text: b[j++] });
    } else {
      out.push({ op: "missing", text: a[i++] });
    }
  }
  return markMisreads(out, new Set(unsure.map(wordKey)));
}

/**
 * A swapped-in word that is a lookalike of the word it replaced, or that the
 * reader itself wasn't sure of, is a misread, not a rewording.
 */
function markMisreads(diff: WordDiff[], unsure: Set<string>): WordDiff[] {
  const out: WordDiff[] = [];
  for (let k = 0; k < diff.length; k++) {
    const cur = diff[k];
    const next = diff[k + 1];
    const pair =
      next &&
      ((cur.op === "extra" && next.op === "missing") || (cur.op === "missing" && next.op === "extra"));
    if (pair) {
      const found = cur.op === "extra" ? cur : next;
      const required = cur.op === "missing" ? cur : next;
      if (isLookalike(required.text, found.text) || unsure.has(wordKey(found.text))) {
        out.push({ op: "misread", text: found.text, expected: required.text });
        k++;
        continue;
      }
    }
    out.push(cur);
  }
  return out;
}

/**
 * 27 CFR 16.22(b). A photo has no scale, so this can't be measured; it's
 * given to the agent to check by eye when the warning looks small.
 */
export function minTypeSize(containerMl: number | null): string {
  if (containerMl == null) return "1 mm (up to 237 mL), 2 mm (up to 3 L) or 3 mm (over 3 L) tall";
  const mm = containerMl <= 237 ? 1 : containerMl <= 3000 ? 2 : 3;
  return `${mm} mm tall, the minimum for a ${formatMl(containerMl)} container`;
}

function worst(statuses: Status[]): Status {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("review")) return "review";
  return "pass";
}

export function checkWarning(w: WarningReading, containerMl: number | null): Check {
  const base = {
    id: "governmentWarning" as const,
    label: "Government warning",
    expected: WARNING_TEXT,
  };

  if (!w.text || !w.text.trim()) {
    return {
      ...base,
      status: w.fully_legible ? "fail" : "review",
      found: null,
      note: w.fully_legible
        ? "No government warning found on the label."
        : "Couldn't find a readable government warning. Check the image.",
    };
  }

  const text = canonical(w.text);
  const details: { status: Status; text: string }[] = [];
  const heading = text.match(HEADING);
  let body = text;

  const firstTwo = text.split(" ").slice(0, 2).join(" ");
  if (!heading && similarity(firstTwo, "government warning") >= 0.75) {
    // "GOVERNIMENT WARNING" is far more likely a misread than a label that misspells it.
    body = text.split(" ").slice(2).join(" ");
    details.push({
      status: "review",
      text: `Heading reads "${firstTwo}", probably a misread of "GOVERNMENT WARNING:". Check by eye.`,
    });
  } else if (!heading) {
    details.push({ status: "fail", text: 'Doesn\'t start with "GOVERNMENT WARNING:".' });
  } else {
    body = text.slice(heading[0].length).trim();
    const printed = heading[0].trim();
    const words = printed.replace(/:$/, "");
    if (words !== words.toUpperCase()) {
      details.push({
        status: "fail",
        text: `Heading reads "${printed}". "GOVERNMENT WARNING" must be in capital letters.`,
      });
    } else if (!heading[1]) {
      details.push({ status: "fail", text: 'Heading is missing its colon: "GOVERNMENT WARNING:".' });
    } else {
      details.push({ status: "pass", text: '"GOVERNMENT WARNING:" is in capital letters.' });
    }
  }

  // Compare the body on words alone first, then on exact characters, so a
  // missing comma reads differently from a changed word.
  const diff = diffWords(WARNING_BODY, body, w.uncertain);
  const changed = diff.filter((d) => d.op !== "same");
  const misreads = changed.filter((d) => d.op === "misread");
  const reworded = changed.filter((d) => d.op !== "misread");
  if (changed.length === 0) {
    if (body === WARNING_BODY) {
      details.push({ status: "pass", text: "Wording matches the required statement exactly." });
    } else {
      details.push({
        status: "review",
        text: "Words match, but punctuation or capitalization differs slightly. Compare by eye.",
      });
    }
  } else if (reworded.length === 0) {
    const m = misreads[0];
    details.push({
      status: "review",
      text: `${misreads.length === 1 ? "One word looks" : `${misreads.length} words look`} like a misread rather than a change (label reads "${m.text}" where "${m.expected}" is required). Check by eye.`,
    });
  } else {
    const missing = reworded.filter((d) => d.op === "missing").length;
    const extra = reworded.filter((d) => d.op === "extra").length;
    const parts = [
      missing && `${missing} required word${missing > 1 ? "s" : ""} missing or changed`,
      extra && `${extra} word${extra > 1 ? "s" : ""} not in the required statement`,
    ].filter(Boolean);
    details.push({
      // A blurry photo can misread a word; don't call that a wording violation.
      status: w.fully_legible ? "fail" : "review",
      text: `Wording differs from the required statement: ${parts.join(", ")}.${
        w.fully_legible ? "" : " Part of the warning is hard to read, so check the image."
      }`,
    });
  }

  // Bold is measured, not read: say what was measured so the agent can weigh it.
  const strokes =
    w.boldRatio != null
      ? `: its strokes measure ${w.boldRatio.toFixed(1)}× the thickness of the text after it`
      : "";
  if (w.heading_bold === "yes") {
    details.push({
      status: "pass",
      text:
        w.rest_bold === "no"
          ? `"GOVERNMENT WARNING:" is bold, and only the heading is${strokes}.`
          : `"GOVERNMENT WARNING:" is in bold${strokes}.`,
    });
  } else if (w.heading_bold === "no") {
    details.push({
      status: "fail",
      text: `"GOVERNMENT WARNING:" isn't bolder than the rest of the statement${strokes}. It must be bold, and only the heading may be.`,
    });
  } else {
    details.push({ status: "review", text: `Couldn't tell if the heading is bold${strokes}. Check by eye.` });
  }
  if (w.rest_bold === "yes" && w.heading_bold !== "no") {
    details.push({
      status: "fail",
      text: 'Only "GOVERNMENT WARNING:" may be bold. The rest of the statement is bold too.',
    });
  }

  // Shrinking or hiding the warning is a common dodge, but size can't be
  // measured from a photo, so this asks for a human look rather than failing.
  if (w.prominence === "small") {
    details.push({
      status: "review",
      text: `Printed much smaller than the label's other text. Check it is at least ${minTypeSize(containerMl)}.`,
    });
  } else if (w.prominence === "buried") {
    details.push({
      status: "review",
      text: `Hard to find: squeezed, crowded into other text, or low contrast. Check it is readily legible and at least ${minTypeSize(containerMl)}.`,
    });
  } else {
    details.push({ status: "pass", text: "Easy to find and read." });
  }

  const status = worst(details.map((d) => d.status));
  return {
    ...base,
    status,
    found: w.text,
    note:
      status === "pass"
        ? "Present, in capitals and bold, worded exactly as required, and easy to read."
        : details
            .filter((d) => d.status !== "pass")
            .map((d) => d.text)
            .join(" "),
    details,
    diff: changed.length ? diff : undefined,
  };
}
