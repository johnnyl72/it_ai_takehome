import Papa from "papaparse";
import { FIELD_LABELS } from "./compare";
import { EMPTY_APPLICATION, type Application, type ApplicationField, type VerificationResult } from "./types";

/** Header spellings people actually use, reduced to letters only. */
const HEADER_ALIASES: Record<string, ApplicationField | "file"> = {
  filename: "file",
  file: "file",
  image: "file",
  imagefile: "file",
  labelimage: "file",
  brandname: "brandName",
  brand: "brandName",
  classtype: "classType",
  class: "classType",
  type: "classType",
  classtypedesignation: "classType",
  alcoholcontent: "alcoholContent",
  alcohol: "alcoholContent",
  abv: "alcoholContent",
  netcontents: "netContents",
  net: "netContents",
  volume: "netContents",
  bottler: "bottler",
  producer: "bottler",
  bottlerproducer: "bottler",
  bottlernameaddress: "bottler",
  nameandaddress: "bottler",
  nameaddress: "bottler",
  countryoforigin: "countryOfOrigin",
  country: "countryOfOrigin",
};

export const CSV_HEADERS = [
  "filename",
  "brand_name",
  "class_type",
  "alcohol_content",
  "net_contents",
  "bottler",
  "country_of_origin",
] as const;

const FIELD_ORDER: ApplicationField[] = [
  "brandName",
  "classType",
  "alcoholContent",
  "netContents",
  "bottler",
  "countryOfOrigin",
];

export interface CsvRow {
  /** The file name as typed in the CSV. */
  name: string;
  /** Spreadsheet row number, header = 1, so problems can point at it. */
  line: number;
  application: Application;
}

export interface ParsedCsv {
  /** Keyed by lowercased file name, so "Label1.JPG" finds "label1.jpg". */
  rows: Map<string, CsvRow>;
  /** Plain-language problems found before anything is checked. */
  problems: string[];
}

export const fileKey = (name: string) => name.trim().toLowerCase();

export function parseApplicationsCsv(text: string): ParsedCsv {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.toLowerCase().replace(/[^a-z]/g, ""),
  });
  const headers = parsed.meta.fields ?? [];
  const fileHeader = headers.find((h) => HEADER_ALIASES[h] === "file");
  if (!fileHeader) {
    return { rows: new Map(), problems: ['The CSV needs a "filename" column naming each label image.'] };
  }
  if (parsed.data.length === 0) {
    return { rows: new Map(), problems: ["The CSV has column headings but no applications under them."] };
  }

  const problems: string[] = [];
  const unknown = headers.filter((h) => h && !HEADER_ALIASES[h]);
  if (unknown.length) {
    problems.push(
      `Columns not recognised, so ignored: ${unknown.join(", ")}. Expected: ${CSV_HEADERS.join(", ")}.`,
    );
  }

  const rows = new Map<string, CsvRow>();
  parsed.data.forEach((raw, i) => {
    const line = i + 2;
    const name = raw[fileHeader]?.trim();
    if (!name) {
      problems.push(`Row ${line} has no file name, so it was skipped.`);
      return;
    }
    const application: Application = { ...EMPTY_APPLICATION };
    for (const h of headers) {
      const field = HEADER_ALIASES[h];
      if (field && field !== "file") application[field] = (raw[h] ?? "").trim();
    }
    if (!application.brandName) {
      problems.push(`Row ${line} (${name}) has no brand name, so the brand won't be checked.`);
    }
    const prior = rows.get(fileKey(name));
    if (prior) problems.push(`"${name}" is on rows ${prior.line} and ${line}; row ${line} was used.`);
    rows.set(fileKey(name), { name, line, application });
  });
  return { rows, problems };
}

export function applicationsToCsv(rows: { file: string; application: Application }[]): string {
  return Papa.unparse({
    fields: [...CSV_HEADERS],
    data: rows.map(({ file, application }) => [file, ...FIELD_ORDER.map((f) => application[f])]),
  });
}

const VERDICT_WORDS = { pass: "Matches", review: "Needs review", fail: "Problems found" } as const;

export interface ResultRow {
  file: string;
  result?: VerificationResult;
  /** What to put in the Result column when there is no result, e.g. "Missing image". */
  status?: string;
  note?: string;
}

/**
 * One line per image and per application, so the export reconciles: nothing
 * that went in is missing from what comes out. Each check records what the
 * label said, not only whether it passed.
 */
export function resultsToCsv(rows: ResultRow[]): string {
  const fieldNames = [...FIELD_ORDER.map((f) => FIELD_LABELS[f]), "Government warning"];
  const fields = [
    "File",
    "Result",
    "Summary",
    ...fieldNames.flatMap((n) => [`${n}: result`, `${n}: label says`]),
  ];
  return Papa.unparse({
    fields,
    data: rows.map(({ file, result, status, note }) => {
      if (!result) return [file, status ?? "Not checked", note ?? "", ...fieldNames.flatMap(() => ["", ""])];
      return [
        file,
        VERDICT_WORDS[result.verdict],
        result.headline,
        ...result.checks.flatMap((c) =>
          c.status === "skipped"
            ? ["", c.found ?? ""]
            : [`${c.status.toUpperCase()}: ${c.note}`, c.found ?? ""],
        ),
      ];
    }),
  });
}
