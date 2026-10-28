import { describe, expect, it } from "vitest";
import { parseApplicationsCsv } from "./csv";
import { reconcile } from "./reconcile";

const csv = (body: string) => parseApplicationsCsv(`filename,brand_name\n${body}`);

describe("reconcile", () => {
  it("accounts for every image and every row, and the counts add up", () => {
    const { rows } = csv("a.jpg,A\nb.jpg,B\nc.jpg,C");
    const r = reconcile([{ name: "a.jpg" }, { name: "B.JPG" }, { name: "z.jpg" }], rows);
    expect(r.counts).toMatchObject({
      images: 3,
      rows: 3,
      matched: 2,
      imagesWithoutRow: 1,
      rowsWithoutImage: 1,
    });
    expect(r.counts.matched + r.counts.imagesWithoutRow).toBe(r.counts.images);
    expect(r.counts.matched + r.counts.rowsWithoutImage).toBe(r.counts.rows);
    expect(r.rowsWithoutImage.map((row) => row.name)).toEqual(["c.jpg"]);
  });

  it("matches a row whose extension differs from the image's", () => {
    const { rows } = csv("label7.png,Seven\nlabel8,Eight");
    const r = reconcile([{ name: "label7.jpg" }, { name: "label8.jpg" }], rows);
    expect(r.pairs.map((p) => p.matchedBy)).toEqual(["base", "base"]);
    expect(r.counts.matchedIgnoringExtension).toBe(2);
  });

  it("prefers an exact name over a bare-name match", () => {
    const { rows } = csv("x.jpg,Exact\nx.png,Other");
    const r = reconcile([{ name: "x.jpg" }], rows);
    expect(r.pairs[0].row?.application.brandName).toBe("Exact");
    expect(r.rowsWithoutImage.map((row) => row.name)).toEqual(["x.png"]);
  });

  it("doesn't guess when a bare name fits two rows", () => {
    const { rows } = csv("x.png,One\nx.gif,Two");
    expect(reconcile([{ name: "x.jpg" }], rows).pairs[0].row).toBeNull();
  });

  it("flags the same image uploaded under two names", () => {
    const r = reconcile(
      [
        { name: "a.jpg", hash: "h1" },
        { name: "b.jpg", hash: "h2" },
        { name: "a-copy.jpg", hash: "h1" },
      ],
      null,
    );
    expect(r.pairs.map((p) => p.duplicateOf)).toEqual([null, null, "a.jpg"]);
    expect(r.counts.duplicates).toBe(1);
  });

  it("works with no CSV at all", () => {
    const r = reconcile([{ name: "a.jpg" }], null);
    expect(r.counts).toMatchObject({ images: 1, rows: 0, matched: 0, imagesWithoutRow: 1 });
  });
});

describe("parseApplicationsCsv preflight", () => {
  it("explains a missing filename column", () => {
    expect(parseApplicationsCsv("brand\nX").problems[0]).toMatch(/filename/);
  });

  it("explains a CSV with headings but no rows", () => {
    expect(parseApplicationsCsv("filename,brand_name\n").problems[0]).toMatch(/no applications/);
  });

  it("names columns it doesn't recognise", () => {
    expect(parseApplicationsCsv("filename,brand_name,colour\na.jpg,A,red").problems[0]).toMatch(/colour/);
  });

  it("points at duplicate rows by row number", () => {
    expect(csv("a.jpg,A\na.jpg,B").problems).toContain('"a.jpg" is on rows 2 and 3; row 3 was used.');
  });

  it("warns about a row with no brand name", () => {
    expect(csv("a.jpg,").problems[0]).toMatch(/Row 2 \(a.jpg\) has no brand name/);
  });
});
