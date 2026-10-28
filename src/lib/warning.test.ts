import { describe, expect, it } from "vitest";
import type { WarningReading } from "./ocr/types";
import { checkWarning, diffWords, minTypeSize, WARNING_BODY, WARNING_TEXT } from "./warning";

type Warning = WarningReading;

const read = (
  text: string | null,
  bold: Warning["heading_bold"] = "yes",
  legible = true,
  extra: Partial<Warning> = {},
) =>
  checkWarning(
    {
      text,
      heading_bold: bold,
      boldRatio: null,
      rest_bold: "no",
      prominence: "clear",
      fully_legible: legible,
      uncertain: [],
      ...extra,
    },
    750,
  );

describe("government warning", () => {
  it("passes the exact statement in caps and bold", () => {
    const c = read(WARNING_TEXT);
    expect(c.status).toBe("pass");
    expect(c.diff).toBeUndefined();
  });

  it("ignores line breaks and curly quotes from the transcription", () => {
    expect(read(WARNING_TEXT.replace(/ /g, "\n").replace(/'/g, "’")).status).toBe("pass");
  });

  it("fails a title-case heading (Jenny's rejection)", () => {
    const c = read(`Government Warning: ${WARNING_BODY}`);
    expect(c.status).toBe("fail");
    expect(c.note).toMatch(/capital letters/);
  });

  it("fails a heading that isn't bold", () => {
    const c = read(WARNING_TEXT, "no");
    expect(c.status).toBe("fail");
    expect(c.note).toMatch(/bold/);
  });

  it("asks for review when boldness can't be judged", () => {
    expect(read(WARNING_TEXT, "unclear").status).toBe("review");
  });

  it("fails changed wording and shows which words", () => {
    const c = read(WARNING_TEXT.replace("may cause health problems", "may cause serious health problems"));
    expect(c.status).toBe("fail");
    expect(c.diff?.filter((d) => d.op === "extra").map((d) => d.text)).toEqual(["serious"]);
  });

  it("fails dropped words", () => {
    const c = read(WARNING_TEXT.replace(" because of the risk of birth defects", ""));
    expect(c.status).toBe("fail");
    expect(c.diff?.filter((d) => d.op === "missing")).toHaveLength(7);
  });

  it("only asks for review of a wording difference when the warning is hard to read", () => {
    expect(read(WARNING_TEXT.replace("machinery", "machlnery"), "yes", false).status).toBe("review");
  });

  it("treats a lookalike-character swap as a misread, not a rewording", () => {
    const c = read(WARNING_TEXT.replace("defects", "defect5"));
    expect(c.status).toBe("review");
    expect(c.note).toMatch(/misread/);
    expect(c.diff?.find((d) => d.op === "misread")).toEqual({
      op: "misread",
      text: "defect5.",
      expected: "defects.",
    });
  });

  it("still fails a real rewording next to a misread", () => {
    const c = read(
      WARNING_TEXT.replace("defects", "defect5").replace("health problems", "serious health problems"),
    );
    expect(c.status).toBe("fail");
  });

  it("treats a changed word the reader was unsure of as a misread", () => {
    const c = read(WARNING_TEXT.replace("beverages during", "peverages during"), "yes", true, {
      uncertain: ["peverages"],
    });
    expect(c.status).toBe("review");
    expect(c.diff?.find((d) => d.op === "misread")?.expected).toBe("beverages");
  });

  it("sends a slightly misread heading to review, not fail", () => {
    const c = read(WARNING_TEXT.replace("GOVERNMENT", "GOVERNIMENT"));
    expect(c.status).toBe("review");
    expect(c.note).toMatch(/probably a misread/);
  });

  it("asks for review when only punctuation differs", () => {
    expect(read(WARNING_TEXT.replace("machinery,", "machinery")).status).toBe("review");
  });

  it("fails a warning that is bold all the way through", () => {
    const c = read(WARNING_TEXT, "yes", true, { rest_bold: "yes" });
    expect(c.status).toBe("fail");
    expect(c.note).toMatch(/Only "GOVERNMENT WARNING:" may be bold/);
  });

  it("sends tiny print to review with the minimum size for the container", () => {
    const c = read(WARNING_TEXT, "yes", true, { prominence: "small" });
    expect(c.status).toBe("review");
    expect(c.note).toMatch(/at least 2 mm tall, the minimum for a 750 mL container/);
  });

  it("sends a buried warning to review", () => {
    expect(read(WARNING_TEXT, "yes", true, { prominence: "buried" }).status).toBe("review");
  });

  it("fails a missing warning", () => {
    expect(read(null).status).toBe("fail");
  });

  it("fails a warning without the heading", () => {
    expect(read(WARNING_BODY).status).toBe("fail");
  });
});

describe("minTypeSize", () => {
  it.each([
    [200, "1 mm"],
    [237, "1 mm"],
    [355, "2 mm"],
    [3000, "2 mm"],
    [5000, "3 mm"],
  ])("%s mL needs %s", (ml, mm) => {
    expect(minTypeSize(ml)).toMatch(new RegExp(`^${mm}`));
  });
});

describe("diffWords", () => {
  it("marks missing and extra words", () => {
    expect(diffWords("a b c", "a x c")).toEqual([
      { op: "same", text: "a" },
      { op: "extra", text: "x" },
      { op: "missing", text: "b" },
      { op: "same", text: "c" },
    ]);
  });
});
