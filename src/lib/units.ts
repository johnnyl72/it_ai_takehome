/**
 * Parsing alcohol content and net contents into numbers, so "45% Alc./Vol."
 * and "45% ABV", or "750 mL" and "75 cL", compare as the same value.
 */

export interface Alcohol {
  abv: number | null;
  proof: number | null;
}

export function parseAlcohol(s: string): Alcohol {
  const text = s.replace(/,/g, ".");
  const abv = text.match(/(\d{1,2}(?:\.\d+)?)\s*(?:%|percent\b)/i);
  const proof = text.match(/(\d{1,3}(?:\.\d+)?)\s*°?\s*proof\b/i);
  return {
    abv: abv ? Number(abv[1]) : null,
    proof: proof ? Number(proof[1]) : null,
  };
}

const ML_PER_UNIT: [RegExp, number, boolean][] = [
  // [pattern, millilitres per unit, metric?]
  [/^(?:ml|millilit(?:er|re)s?)$/, 1, true],
  [/^(?:cl|centilit(?:er|re)s?)$/, 10, true],
  [/^(?:l|lit(?:er|re)s?)$/, 1000, true],
  [/^(?:fl\.?\s*oz\.?|fluid\s+ounces?|oz\.?|ounces?)$/, 29.5735, false],
  [/^(?:pints?|pt\.?)$/, 473.176, false],
  [/^(?:quarts?|qt\.?)$/, 946.353, false],
  [/^(?:gallons?|gal\.?)$/, 3785.41, false],
];

const VOLUME =
  /(\d+(?:[.,]\d+)?)\s*(millilit(?:er|re)s?|ml|centilit(?:er|re)s?|cl|lit(?:er|re)s?|l|fl\.?\s*oz\.?|fluid\s+ounces?|oz\.?|ounces?|pints?|pt\.?|quarts?|qt\.?|gallons?|gal\.?)(?![a-z])/gi;

/**
 * Returns the volume in mL, or null if none is found. Labels often state both
 * systems ("750 mL (25.4 FL OZ)"), so the first metric figure wins; adding
 * them up would double the volume.
 */
export function parseVolumeMl(s: string): number | null {
  const found: { ml: number; metric: boolean }[] = [];
  for (const m of s.matchAll(VOLUME)) {
    const qty = Number(m[1].replace(",", "."));
    const unit = m[2].toLowerCase().trim();
    const entry = ML_PER_UNIT.find(([re]) => re.test(unit));
    if (entry) found.push({ ml: qty * entry[1], metric: entry[2] });
  }
  if (!found.length) return null;
  return (found.find((f) => f.metric) ?? found[0]).ml;
}

export function formatMl(ml: number): string {
  return ml >= 1000 ? `${+(ml / 1000).toFixed(3)} L` : `${+ml.toFixed(1)} mL`;
}
