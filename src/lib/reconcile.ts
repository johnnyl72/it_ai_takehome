import { fileKey, type CsvRow } from "./csv";

/**
 * Matches label images to application rows and accounts for every one of
 * each. Like reconciling a print run against its code list: the application
 * list is the source of truth, and the counts must add up, so nothing that
 * went in disappears without a line saying why.
 */

export interface ImageIn {
  name: string;
  /** Content hash, to spot the same image uploaded under two names. */
  hash?: string;
}

export interface Pair<T extends ImageIn> {
  image: T;
  row: CsvRow | null;
  /** "base": matched on the name without its extension (CSV says .png, file is .jpg). */
  matchedBy: "name" | "base" | null;
  /** Name of an earlier image with identical content, if any. */
  duplicateOf: string | null;
}

export interface Reconciliation<T extends ImageIn> {
  pairs: Pair<T>[];
  /** Applications with no label image. */
  rowsWithoutImage: CsvRow[];
  counts: {
    images: number;
    rows: number;
    matched: number;
    matchedIgnoringExtension: number;
    imagesWithoutRow: number;
    rowsWithoutImage: number;
    duplicates: number;
  };
}

const baseKey = (name: string) => fileKey(name).replace(/\.[a-z0-9]{2,5}$/, "");

export function reconcile<T extends ImageIn>(
  images: T[],
  rows: Map<string, CsvRow> | null,
): Reconciliation<T> {
  const used = new Set<string>();
  const pairs: Pair<T>[] = images.map((image) => ({ image, row: null, matchedBy: null, duplicateOf: null }));

  if (rows) {
    for (const p of pairs) {
      const key = fileKey(p.image.name);
      const row = rows.get(key);
      if (row && !used.has(key)) {
        p.row = row;
        p.matchedBy = "name";
        used.add(key);
      }
    }
    // Second pass on the bare name, but only where it's unambiguous.
    const byBase = new Map<string, string[]>();
    for (const key of rows.keys()) {
      if (used.has(key)) continue;
      const b = baseKey(key);
      byBase.set(b, [...(byBase.get(b) ?? []), key]);
    }
    for (const p of pairs) {
      if (p.row) continue;
      const candidates = (byBase.get(baseKey(p.image.name)) ?? []).filter((k) => !used.has(k));
      if (candidates.length === 1) {
        p.row = rows.get(candidates[0])!;
        p.matchedBy = "base";
        used.add(candidates[0]);
      }
    }
  }

  const firstWithHash = new Map<string, string>();
  for (const p of pairs) {
    const h = p.image.hash;
    if (!h) continue;
    const first = firstWithHash.get(h);
    if (first) p.duplicateOf = first;
    else firstWithHash.set(h, p.image.name);
  }

  const rowsWithoutImage = rows ? [...rows.entries()].filter(([k]) => !used.has(k)).map(([, r]) => r) : [];
  const matched = pairs.filter((p) => p.row).length;
  return {
    pairs,
    rowsWithoutImage,
    counts: {
      images: images.length,
      rows: rows?.size ?? 0,
      matched,
      matchedIgnoringExtension: pairs.filter((p) => p.matchedBy === "base").length,
      imagesWithoutRow: images.length - matched,
      rowsWithoutImage: rowsWithoutImage.length,
      duplicates: pairs.filter((p) => p.duplicateOf).length,
    },
  };
}
