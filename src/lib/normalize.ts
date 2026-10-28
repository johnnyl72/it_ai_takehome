/**
 * Text normalization for comparing label text with application text.
 *
 * Two levels, because agents treat them differently:
 * - `canonical` only removes differences no one would call a mismatch
 *   (curly vs straight quotes, line breaks, double spaces).
 * - `loose` also drops case and punctuation, so "STONE'S THROW" and
 *   "Stone's Throw" compare equal. A loose-only match still passes, but the
 *   result says what differed so the agent can see it.
 */

export function canonical(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‚‛′`´]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Removes accents: "Château" becomes "Chateau". OCR often drops them. */
export const unaccent = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "");

export function loose(s: string): string {
  return unaccent(canonical(s))
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/'/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function tokens(s: string): string[] {
  const l = loose(s);
  return l ? l.split(" ") : [];
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** 1 = identical, 0 = nothing in common. Compared on the loose form. */
export function similarity(a: string, b: string): number {
  const x = loose(a);
  const y = loose(b);
  const longest = Math.max(x.length, y.length);
  return longest === 0 ? 1 : 1 - levenshtein(x, y) / longest;
}

/**
 * Collapses characters a reader commonly confuses on print (0/O, 1/l/I,
 * 5/S, 8/B, rn/m, vv/w). Two strings that differ only in these are more
 * likely one misread than a real difference on the label. The same idea as
 * a barcode verifier reporting "no read" separately from a wrong code.
 */
export function foldLookalikes(s: string): string {
  return loose(s)
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/[0]/g, "o")
    .replace(/[1i|!]/g, "l")
    .replace(/5/g, "s")
    .replace(/8/g, "b");
}

/** True if `a` and `b` differ, but only by lookalike characters. */
export function isLookalike(a: string, b: string): boolean {
  return loose(a) !== loose(b) && foldLookalikes(a) === foldLookalikes(b);
}

/** True if every word of `needle` appears in `haystack`, in order. */
export function containsWords(haystack: string, needle: string): boolean {
  const h = ` ${loose(haystack)} `;
  const n = loose(needle);
  return n.length > 0 && h.includes(` ${n} `);
}

/** Explains a loose-only match in words an agent would use. */
export function describeDifference(expected: string, found: string): string {
  const e = canonical(expected);
  const f = canonical(found);
  if (e === f) return "Exact match.";
  if (e.toLowerCase() === f.toLowerCase()) {
    if (f === f.toUpperCase()) return "Same words. The label prints it in capital letters.";
    return "Same words, different capitalization.";
  }
  if (unaccent(e).toLowerCase() === unaccent(f).toLowerCase() && e.toLowerCase() !== f.toLowerCase()) {
    return `Same words, but the accents differ (the label reads "${f}"). Check by eye if it matters.`;
  }
  return "Same words, different punctuation or spacing.";
}
