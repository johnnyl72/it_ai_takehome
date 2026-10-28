/**
 * Finds what the label says for each application field. OCR returns lines
 * of text, not labelled fields, so the application drives the search: look
 * for what it says should be there, the way a print run is checked against
 * its code list. The comparison in compare.ts then judges what was found.
 */
import { loose, similarity, tokens } from "./normalize";
import type { OcrLine } from "./ocr/types";
import { parseAlcohol, parseVolumeMl } from "./units";

/** Below this, the best match is just noise: report "not found" instead of a random span. */
const FOUND = 0.6;

const isWarningLine = (l: OcrLine) =>
  /government\s+warning|surgeon general|pregnancy|machinery/i.test(l.text);

/**
 * The lines holding the best match for `expected`, whole, so extra words on
 * the label still show up (and send the field to review).
 */
export function locateText(passes: OcrLine[][], expected: string): string | null {
  const n = tokens(expected).length;
  if (!n) return null;
  let best: { score: number; whole: number; text: string } | null = null;
  for (const lines of passes) {
    const words = lines.flatMap((l, li) =>
      isWarningLine(l) ? [] : l.words.map((w) => ({ text: w.text, li })),
    );
    for (let i = 0; i < words.length; i++) {
      for (let len = Math.max(1, n - 2); len <= n + 2 && i + len <= words.length; len++) {
        const span = words.slice(i, i + len);
        const score = similarity(span.map((w) => w.text).join(" "), expected);
        if (best && score < best.score) continue;
        const text = lines
          .slice(span[0].li, span[span.length - 1].li + 1)
          .map((l) => l.text)
          .join(" ");
        // On a tie, prefer the match that stands alone, e.g. the brand line over the bottler line that repeats it.
        const whole = similarity(text, expected);
        if (!best || score > best.score || whole > best.whole) best = { score, whole, text };
      }
    }
  }
  return best && best.score >= FOUND ? best.text : null;
}

function firstMatching(passes: OcrLine[][], test: (l: OcrLine) => boolean, prefer: (l: OcrLine) => boolean) {
  const all = passes.flat().filter((l) => !isWarningLine(l) && test(l));
  return (all.find(prefer) ?? all[0])?.text ?? null;
}

export function locateAlcohol(passes: OcrLine[][], expected: string): string | null {
  const want = parseAlcohol(expected);
  const abv = want.abv ?? (want.proof != null ? want.proof / 2 : null);
  return firstMatching(
    passes,
    (l) => /%|proof/i.test(l.text),
    (l) => abv != null && parseAlcohol(l.text).abv === abv,
  );
}

export function locateVolume(passes: OcrLine[][], expected: string): string | null {
  const want = parseVolumeMl(expected);
  return firstMatching(
    passes,
    (l) => parseVolumeMl(l.text) != null,
    (l) => want != null && Math.abs((parseVolumeMl(l.text) ?? 0) - want) / want <= 0.005,
  );
}

const BOTTLER_LEAD =
  /\b(?:bottled|distilled|imported|brewed|produced|vinted|blended|canned|cellared|made)\b.*\bby\b/i;

/** The "Bottled by ..." line, plus the next line when the address carries on there. */
export function locateBottler(passes: OcrLine[][], expected: string): string | null {
  for (const lines of passes) {
    const at = lines.findIndex((l) => BOTTLER_LEAD.test(l.text));
    if (at < 0) continue;
    const line = lines[at];
    const next = lines[at + 1];
    const h = line.bbox.y1 - line.bbox.y0;
    const continues =
      next &&
      next.bbox.y0 - line.bbox.y1 < 1.2 * h &&
      next.words.length <= 6 &&
      !isWarningLine(next) &&
      !/%|product of|made in/i.test(next.text) &&
      parseVolumeMl(next.text) == null;
    return continues ? `${line.text} ${next.text}` : line.text;
  }
  return locateText(passes, expected);
}

export function locateCountry(passes: OcrLine[][], expected: string): string | null {
  const stated = firstMatching(
    passes,
    (l) => /\b(?:product|produce|made|produced|imported)\s+(?:of|in|from)\b/i.test(l.text),
    (l) => loose(l.text).includes(loose(expected)),
  );
  return stated ?? locateText(passes, expected);
}
