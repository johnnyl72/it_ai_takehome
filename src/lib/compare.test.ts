import { describe, expect, it } from "vitest";
import { checkField, compareLabel } from "./compare";
import { readingOf } from "./ocr/testing";
import { EMPTY_APPLICATION } from "./types";
import { WARNING_TEXT } from "./warning";

const field = (f: Parameters<typeof checkField>[0], expected: string, found: string | null) =>
  checkField(f, expected, found, false);

describe("brand name", () => {
  it("passes a case-only difference and says so (Dave's STONE'S THROW)", () => {
    const c = field("brandName", "Stone's Throw", "STONE'S THROW");
    expect(c.status).toBe("pass");
    expect(c.note).toMatch(/capital letters/);
  });

  it("treats curly and straight apostrophes as the same", () => {
    expect(field("brandName", "Stone's Throw", "Stone’s Throw").note).toBe("Exact match.");
  });

  it("sends a one-letter difference to review, not pass", () => {
    expect(field("brandName", "Old Tom Distillery", "Old Tim Distillery").status).toBe("review");
  });

  it("calls a lookalike-character difference a probable misread", () => {
    const c = field("brandName", "Old Tom Distillery", "0LD T0M DISTILLERY");
    expect(c.status).toBe("review");
    expect(c.note).toMatch(/misread/);
  });

  it("fails a different brand", () => {
    expect(field("brandName", "Old Tom Distillery", "Eagle Peak").status).toBe("fail");
  });

  it("fails when the brand is missing from the label", () => {
    expect(field("brandName", "Old Tom Distillery", null).status).toBe("fail");
  });

  it("only asks for review when the image is too poor to be sure", () => {
    expect(checkField("brandName", "Old Tom Distillery", null, true).status).toBe("review");
  });
});

describe("class / type", () => {
  it("flags extra words on the label for review", () => {
    expect(field("classType", "Bourbon Whiskey", "Kentucky Straight Bourbon Whiskey").status).toBe("review");
  });
});

describe("alcohol content", () => {
  it("matches the same strength written differently", () => {
    const c = field("alcoholContent", "45% ABV", "45% Alc./Vol. (90 Proof)");
    expect(c.status).toBe("pass");
    expect(c.note).toMatch(/45%/);
  });

  it("fails a different strength", () => {
    const c = field("alcoholContent", "45%", "40% Alc./Vol. (80 Proof)");
    expect(c.status).toBe("fail");
    expect(c.note).toBe("Application says 45%, label says 40%.");
  });

  it("fails a label whose proof contradicts its percentage", () => {
    expect(field("alcoholContent", "45%", "45% Alc./Vol. (80 Proof)").status).toBe("fail");
  });

  it("accepts an application that gives proof only", () => {
    expect(field("alcoholContent", "90 proof", "45% Alc./Vol.").status).toBe("pass");
  });

  it("reads decimal commas", () => {
    expect(field("alcoholContent", "13.5%", "13,5% vol").status).toBe("pass");
  });
});

describe("net contents", () => {
  it.each([
    ["750 mL", "750 ML"],
    ["750 mL", "75 cL"],
    ["1.75 L", "1750 mL"],
    ["12 fl oz", "12 FL. OZ. (355 mL)"],
    ["750 mL", "750 mL (25.4 FL OZ)"],
  ])("%s matches %s", (e, f) => {
    expect(field("netContents", e, f).status).toBe("pass");
  });

  it("fails a different volume", () => {
    expect(field("netContents", "750 mL", "700 mL").status).toBe("fail");
  });
});

describe("bottler", () => {
  it("ignores the 'Distilled and bottled by' lead-in and state abbreviations", () => {
    const c = field(
      "bottler",
      "Old Tom Distillery, Louisville, Kentucky",
      "DISTILLED AND BOTTLED BY OLD TOM DISTILLERY, LOUISVILLE, KY",
    );
    expect(c.status).toBe("pass");
  });

  it("fails a different producer", () => {
    expect(
      field("bottler", "Old Tom Distillery, Louisville, KY", "Bottled by Acme Spirits, Reno, NV").status,
    ).toBe("fail");
  });
});

describe("country of origin", () => {
  it("matches 'Product of France' to 'France'", () => {
    expect(field("countryOfOrigin", "France", "PRODUCT OF FRANCE").status).toBe("pass");
  });

  it("knows USA is the United States", () => {
    expect(field("countryOfOrigin", "United States", "Product of USA").status).toBe("pass");
  });

  it("fails a different country", () => {
    expect(field("countryOfOrigin", "France", "Product of Italy").status).toBe("fail");
  });
});

describe("compareLabel", () => {
  // What OCR returns for the brief's sample: lines, brand split over two.
  const label = readingOf(
    [
      "SMALL BATCH - EST. 1892",
      "OLD TOM",
      "DISTILLERY",
      "Kentucky Straight Bourbon",
      "Whiskey",
      "45% Alc./Vol. (90 Proof)",
      "750 mL",
      "Distilled and bottled by Old Tom Distillery,",
      "Louisville, KY",
    ],
    { text: WARNING_TEXT },
  );
  const app = {
    ...EMPTY_APPLICATION,
    brandName: "Old Tom Distillery",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
  };
  const timing = { totalMs: 0, readMs: 0 };

  it("passes the brief's sample label", () => {
    const r = compareLabel(app, label, timing, "test");
    expect(r.verdict).toBe("pass");
    expect(r.headline).toBe("Everything matches");
    expect(r.checks.find((c) => c.id === "brandName")?.found).toBe("OLD TOM DISTILLERY");
    expect(r.checks.filter((c) => c.status === "skipped").map((c) => c.id)).toEqual([
      "bottler",
      "countryOfOrigin",
    ]);
  });

  it("finds the name and address across two lines", () => {
    const r = compareLabel(
      { ...app, bottler: "Old Tom Distillery, Louisville, Kentucky" },
      label,
      timing,
      "test",
    );
    expect(r.checks.find((c) => c.id === "bottler")).toMatchObject({
      status: "pass",
      found: "Distilled and bottled by Old Tom Distillery, Louisville, KY",
    });
  });

  it("never gives a clean pass on a poor image", () => {
    const r = compareLabel(app, { ...label, imageQuality: "poor", imageIssues: "glare" }, timing, "test");
    expect(r.verdict).toBe("review");
    expect(r.imageNote).toMatch(/glare/);
  });

  it("says so when hardly any text could be read", () => {
    const r = compareLabel(app, { ...label, textFound: false }, timing, "test");
    expect(r.imageNote).toMatch(/Hardly any text/);
  });

  it("doesn't claim everything matches when there was nothing to compare", () => {
    const r = compareLabel(EMPTY_APPLICATION, label, timing, "test");
    expect(r.verdict).toBe("pass");
    expect(r.headline).toMatch(/no application details/);
  });

  it("counts problems in the headline", () => {
    const r = compareLabel({ ...app, alcoholContent: "40%" }, label, timing, "test");
    expect(r.verdict).toBe("fail");
    expect(r.headline).toBe("1 problem found");
  });

  it("reports a brand that isn't on the label as not found", () => {
    const r = compareLabel({ ...app, brandName: "Eagle Peak" }, label, timing, "test");
    expect(r.checks.find((c) => c.id === "brandName")).toMatchObject({ status: "fail", found: null });
  });
});

describe("accents", () => {
  it("passes Château read as CHATEAU, and says the accents differ", () => {
    const c = field("brandName", "Château Marcel", "CHATEAU MARCEL");
    expect(c.status).toBe("pass");
  });
});
