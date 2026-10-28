import { describe, expect, it } from "vitest";
import { estimateSkew, rotate, strokeWidth } from "./image";
import type { GrayImage } from "./types";

function blank(width: number, height: number): GrayImage {
  return { data: new Uint8Array(width * height).fill(255), width, height };
}

function fillRect(img: GrayImage, x: number, y: number, w: number, h: number, v = 0) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) img.data[yy * img.width + xx] = v;
}

/** Rows of short dashes, like lines of text. */
function textLike(width = 600, height = 400): GrayImage {
  const img = blank(width, height);
  for (let row = 40; row < height - 40; row += 30) {
    for (let x = 40; x < width - 60; x += 18) fillRect(img, x, row, 12, 10);
  }
  return img;
}

describe("estimateSkew", () => {
  it("finds level text level", () => {
    expect(Math.abs(estimateSkew(textLike()))).toBeLessThanOrEqual(0.3);
  });

  it("measures tilted text, and rotating back levels it", () => {
    const tilted = rotate(textLike(), 7);
    const skew = estimateSkew(tilted);
    expect(skew).toBeGreaterThan(6);
    expect(skew).toBeLessThan(8);
    expect(Math.abs(estimateSkew(rotate(tilted, -skew)))).toBeLessThanOrEqual(0.5);
  });

  it("handles the other direction", () => {
    expect(estimateSkew(rotate(textLike(), -5))).toBeCloseTo(-5, 0);
  });
});

describe("strokeWidth", () => {
  it("tells thin strokes from thick ones", () => {
    const img = blank(200, 60);
    for (let x = 10; x < 90; x += 10) fillRect(img, x, 10, 2, 40);
    for (let x = 110; x < 190; x += 12) fillRect(img, x, 10, 5, 40);
    expect(strokeWidth(img, { x0: 0, y0: 0, x1: 100, y1: 60 })).toBe(2);
    expect(strokeWidth(img, { x0: 100, y0: 0, x1: 200, y1: 60 })).toBe(5);
  });

  it("measures a horizontal bar by its height, not its length", () => {
    const img = blank(100, 40);
    fillRect(img, 10, 18, 80, 3);
    expect(strokeWidth(img, { x0: 0, y0: 0, x1: 100, y1: 40 })).toBe(3);
  });
});
