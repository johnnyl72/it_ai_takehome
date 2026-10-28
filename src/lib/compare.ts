import {
  canonical,
  containsWords,
  describeDifference,
  isLookalike,
  loose,
  similarity,
  tokens,
} from "./normalize";
import { formatMl, parseAlcohol, parseVolumeMl } from "./units";
import { checkWarning } from "./warning";
import { locateAlcohol, locateBottler, locateCountry, locateText, locateVolume } from "./locate";
import type { LabelReading, OcrLine } from "./ocr/types";
import type { Application, ApplicationField, Check, Status, VerificationResult } from "./types";

export const FIELD_LABELS: Record<ApplicationField, string> = {
  brandName: "Brand name",
  classType: "Class / type",
  alcoholContent: "Alcohol content",
  netContents: "Net contents",
  bottler: "Bottler / producer",
  countryOfOrigin: "Country of origin",
};

/** Close enough to be a typo or a misread, too different to wave through. */
const NEAR_MATCH = 0.85;

type Compared = Pick<Check, "status" | "note">;

function skipped(field: ApplicationField, found: string | null): Check {
  return {
    id: field,
    label: FIELD_LABELS[field],
    status: "skipped",
    expected: null,
    found,
    note: "Not on the application, so not checked.",
  };
}

function compareText(expected: string, found: string): Compared {
  if (canonical(expected) === canonical(found)) return { status: "pass", note: "Exact match." };
  if (loose(expected) === loose(found)) {
    return { status: "pass", note: describeDifference(expected, found) };
  }
  if (isLookalike(expected, found)) {
    return {
      status: "review",
      note: "Same text except a lookalike character (such as 0 for O, or 1 for l). Probably a misread; check by eye.",
    };
  }
  if (similarity(expected, found) >= NEAR_MATCH) {
    return {
      status: "review",
      note: "Very close but not the same. Check the spelling.",
    };
  }
  if (containsWords(found, expected)) {
    return {
      status: "review",
      note: "The label adds words to what the application says. Check they belong.",
    };
  }
  return { status: "fail", note: "Doesn't match the application." };
}

function compareAlcohol(expected: string, found: string): Compared {
  const e = parseAlcohol(expected);
  const f = parseAlcohol(found);
  const want = e.abv ?? (e.proof != null ? e.proof / 2 : null);
  if (want == null) return compareText(expected, found);

  if (f.abv == null) {
    if (f.proof != null && Math.abs(f.proof / 2 - want) < 0.05) {
      return {
        status: "review",
        note: "Label shows proof but no percent alcohol by volume. Check the requirement for this product.",
      };
    }
    return { status: "fail", note: `Application says ${want}%. No matching alcohol content on the label.` };
  }
  if (Math.abs(f.abv - want) >= 0.05) {
    return { status: "fail", note: `Application says ${want}%, label says ${f.abv}%.` };
  }
  if (f.proof != null && Math.abs(f.proof - f.abv * 2) >= 0.1) {
    return {
      status: "fail",
      note: `Label's proof doesn't agree with its percentage: ${f.abv}% is ${f.abv * 2} proof, not ${f.proof}.`,
    };
  }
  return {
    status: "pass",
    note:
      canonical(expected) === canonical(found)
        ? "Exact match."
        : `Same strength (${want}%), written differently.`,
  };
}

function compareVolume(expected: string, found: string): Compared {
  const e = parseVolumeMl(expected);
  const f = parseVolumeMl(found);
  if (e == null || f == null) return compareText(expected, found);
  // 0.5% covers rounding between systems (750 mL is printed as 25.4 fl oz).
  if (Math.abs(e - f) / e > 0.005) {
    return { status: "fail", note: `Application says ${formatMl(e)}, label says ${formatMl(f)}.` };
  }
  return {
    status: "pass",
    note:
      canonical(expected) === canonical(found)
        ? "Exact match."
        : `Same volume (${formatMl(e)}), written differently.`,
  };
}

/** Phrases that introduce the name and address but aren't part of it. */
const BOTTLER_LEAD =
  /^(?:(?:distilled|blended|bottled|produced|made|vinted|brewed|imported|cellared|crafted|packed|canned)(?:\s*(?:,|and|&)\s*)?)+\s*(?:for\s+and\s+)?by\b\s*:?/i;

const STATES: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  wisconsin: "wi",
  wyoming: "wy",
};
const TWO_WORD_STATES: Record<string, string> = {
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  "west virginia": "wv",
};

function addressTokens(s: string): string[] {
  let l = loose(s.replace(BOTTLER_LEAD, ""));
  for (const [name, abbr] of Object.entries(TWO_WORD_STATES)) {
    l = l.replace(new RegExp(`\\b${name}\\b`, "g"), abbr);
  }
  return tokens(l).map((t) => STATES[t] ?? t);
}

function compareBottler(expected: string, found: string): Compared {
  const e = addressTokens(expected);
  const f = new Set(addressTokens(found));
  const shared = e.filter((t) => f.has(t)).length;
  if (e.length && shared === e.length) {
    return {
      status: "pass",
      note:
        loose(expected) === loose(found) ? describeDifference(expected, found) : "Name and address match.",
    };
  }
  if (e.length && shared / e.length >= 0.75) {
    const missing = e.filter((t) => !f.has(t));
    return { status: "review", note: `Mostly matches. Not found on the label: ${missing.join(", ")}.` };
  }
  return { status: "fail", note: "Name or address doesn't match the application." };
}

const COUNTRY_LEAD = /^(?:product\s+of|produce\s+of|made\s+in|produced\s+in|imported\s+from)\s+/i;
const COUNTRY_ALIASES: Record<string, string> = {
  us: "united states",
  usa: "united states",
  "united states of america": "united states",
  america: "united states",
  uk: "united kingdom",
  "great britain": "united kingdom",
  britain: "united kingdom",
  england: "united kingdom",
  scotland: "united kingdom",
  holland: "netherlands",
  "the netherlands": "netherlands",
};

function countryKey(s: string): string {
  const l = loose(canonical(s).replace(COUNTRY_LEAD, ""));
  return COUNTRY_ALIASES[l] ?? l;
}

function compareCountry(expected: string, found: string): Compared {
  if (countryKey(expected) === countryKey(found)) {
    return {
      status: "pass",
      note: canonical(expected) === canonical(found) ? "Exact match." : "Same country, written differently.",
    };
  }
  return compareText(expected, found);
}

const COMPARERS: Record<ApplicationField, (e: string, f: string) => Compared> = {
  brandName: compareText,
  classType: compareText,
  alcoholContent: compareAlcohol,
  netContents: compareVolume,
  bottler: compareBottler,
  countryOfOrigin: compareCountry,
};

/** How to find each field's text on the label, given what the application says. */
const LOCATORS: Record<ApplicationField, (passes: OcrLine[][], expected: string) => string | null> = {
  brandName: locateText,
  classType: locateText,
  alcoholContent: locateAlcohol,
  netContents: locateVolume,
  bottler: locateBottler,
  countryOfOrigin: locateCountry,
};

export function checkField(
  field: ApplicationField,
  expected: string,
  found: string | null,
  imagePoor: boolean,
): Check {
  if (!expected.trim()) return skipped(field, found);
  const base = { id: field, label: FIELD_LABELS[field], expected, found };
  if (!found || !found.trim()) {
    return {
      ...base,
      status: imagePoor ? "review" : "fail",
      note: imagePoor
        ? "Not found, but the image is hard to read. Check the image."
        : "Not found on the label.",
    };
  }
  return { ...base, ...COMPARERS[field](expected, found) };
}

function verdictOf(statuses: Status[]): VerificationResult["verdict"] {
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("review")) return "review";
  return "pass";
}

function headlineOf(checks: Check[]): string {
  const fails = checks.filter((c) => c.status === "fail").length;
  const reviews = checks.filter((c) => c.status === "review").length;
  if (fails) {
    return `${fails} problem${fails > 1 ? "s" : ""} found${reviews ? `, ${reviews} more to review` : ""}`;
  }
  if (reviews) return `${reviews} item${reviews > 1 ? "s" : ""} need${reviews > 1 ? "" : "s"} your review`;
  // "Everything matches" would overstate a check that compared nothing.
  if (checks.every((c) => c.status === "skipped" || c.id === "governmentWarning")) {
    return "Warning is correct; no application details to compare";
  }
  return "Everything matches";
}

export function compareLabel(
  application: Application,
  reading: LabelReading,
  timing: VerificationResult["timing"],
  engine: string,
): VerificationResult {
  const imagePoor = reading.imageQuality === "poor";
  const checks: Check[] = (Object.keys(FIELD_LABELS) as ApplicationField[]).map((field) => {
    const expected = application[field].trim();
    const found = expected ? LOCATORS[field](reading.passes, expected) : null;
    return checkField(field, expected, found, imagePoor);
  });
  // The label's own net contents decide the warning's minimum type size.
  const net = checks.find((c) => c.id === "netContents")?.found;
  const containerMl = parseVolumeMl(net ?? "") ?? parseVolumeMl(application.netContents);
  checks.push(checkWarning(reading.warning, containerMl));

  let imageNote: string | null = null;
  if (!reading.textFound) {
    imageNote =
      "Hardly any text could be read on this image. Check it's the right image and that the label is in focus.";
  } else if (imagePoor) {
    imageNote = `The image is hard to read${
      reading.imageIssues ? ` (${reading.imageIssues})` : ""
    }. If results look wrong, ask the applicant for a clearer image.`;
  }

  const fieldVerdict = verdictOf(checks.map((c) => c.status));
  // A poor image never gets a clean pass on its own say-so.
  const verdict = imageNote && fieldVerdict === "pass" ? "review" : fieldVerdict;

  return {
    verdict,
    headline: verdict !== fieldVerdict ? "Image needs a closer look" : headlineOf(checks),
    checks,
    imageNote,
    reading: {
      lines: reading.lines,
      meanConfidence: reading.meanConfidence,
      imageQuality: reading.imageQuality,
      straightenedBy: reading.straightenedBy,
    },
    timing,
    engine,
  };
}
