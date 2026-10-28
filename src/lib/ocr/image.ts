/**
 * Pixel work on grayscale images, in plain code so the browser and the Node
 * eval do exactly the same thing. Nothing here is clever, only predictable.
 */
import type { Box, GrayImage } from "./types";

export function toGray(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): GrayImage {
  const data = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i++, j += 4) {
    // Rec. 601 luma; transparent pixels count as white paper.
    const a = rgba[j + 3] / 255;
    const y = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    data[i] = Math.round(y * a + 255 * (1 - a));
  }
  return { data, width, height };
}

export function toRgba(img: GrayImage): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(img.width * img.height * 4));
  for (let i = 0, j = 0; i < img.data.length; i++, j += 4) {
    out[j] = out[j + 1] = out[j + 2] = img.data[i];
    out[j + 3] = 255;
  }
  return out;
}

/** Bilinear sample, white outside the image. */
function sample(img: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= img.width - 1 || y0 >= img.height - 1) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    return xi >= 0 && yi >= 0 && xi < img.width && yi < img.height ? img.data[yi * img.width + xi] : 255;
  }
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * img.width + x0;
  const d = img.data;
  const top = d[i] + (d[i + 1] - d[i]) * fx;
  const bottom = d[i + img.width] + (d[i + img.width + 1] - d[i + img.width]) * fx;
  return top + (bottom - top) * fy;
}

export function scale(img: GrayImage, factor: number): GrayImage {
  const width = Math.max(1, Math.round(img.width * factor));
  const height = Math.max(1, Math.round(img.height * factor));
  const data = new Uint8Array(width * height);
  if (factor < 1) {
    // Shrinking: average the source pixels each output pixel covers, or fine print turns to noise.
    const step = 1 / factor;
    for (let y = 0; y < height; y++) {
      const sy0 = Math.floor(y * step);
      const sy1 = Math.min(img.height, Math.max(sy0 + 1, Math.floor((y + 1) * step)));
      for (let x = 0; x < width; x++) {
        const sx0 = Math.floor(x * step);
        const sx1 = Math.min(img.width, Math.max(sx0 + 1, Math.floor((x + 1) * step)));
        let sum = 0;
        for (let sy = sy0; sy < sy1; sy++)
          for (let sx = sx0; sx < sx1; sx++) sum += img.data[sy * img.width + sx];
        data[y * width + x] = Math.round(sum / ((sy1 - sy0) * (sx1 - sx0)));
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++)
        data[y * width + x] = sample(img, (x + 0.5) / factor - 0.5, (y + 0.5) / factor - 0.5);
    }
  }
  return { data, width, height };
}

/**
 * Rotates the content by `degrees`, clockwise as seen on screen, growing the
 * canvas so no corner is cut off. New areas are white.
 */
export function rotate(img: GrayImage, degrees: number): GrayImage {
  if (Math.abs(degrees) < 0.05) return img;
  const t = (degrees * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const width = Math.ceil(Math.abs(img.width * c) + Math.abs(img.height * s));
  const height = Math.ceil(Math.abs(img.width * s) + Math.abs(img.height * c));
  const data = new Uint8Array(width * height);
  const cx = img.width / 2;
  const cy = img.height / 2;
  const ox = width / 2;
  const oy = height / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Inverse map: undo a clockwise turn (y points down) to find the source pixel.
      const dx = x - ox;
      const dy = y - oy;
      data[y * width + x] = sample(img, dx * c + dy * s + cx, -dx * s + dy * c + cy);
    }
  }
  return { data, width, height };
}

export function crop(img: GrayImage, box: Box): GrayImage {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(img.width, Math.ceil(box.x1));
  const y1 = Math.min(img.height, Math.ceil(box.y1));
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    data.set(img.data.subarray((y0 + y) * img.width + x0, (y0 + y) * img.width + x0 + width), y * width);
  }
  return { data, width, height };
}

/**
 * Ink = noticeably darker than its neighbourhood (Bradley's adaptive
 * threshold). A dark background or a glare patch is not ink; text is.
 */
export function inkMask(img: GrayImage): Uint8Array {
  const { width: w, height: h, data } = img;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const r = Math.max(7, Math.round(Math.max(w, h) / 32));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const ya = Math.max(0, y - r);
    const yb = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const xa = Math.max(0, x - r);
      const xb = Math.min(w, x + r + 1);
      const sum =
        integral[yb * (w + 1) + xb] -
        integral[ya * (w + 1) + xb] -
        integral[yb * (w + 1) + xa] +
        integral[ya * (w + 1) + xa];
      const mean = sum / ((yb - ya) * (xb - xa));
      if (data[y * w + x] < mean * 0.85) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/**
 * Black ink on white, by local contrast. Glare washes text out against the
 * whole label but not against its own surroundings, so this brings it back.
 */
export function binarize(img: GrayImage): GrayImage {
  const mask = inkMask(img);
  const data = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) data[i] = mask[i] ? 0 : 255;
  return { data, width: img.width, height: img.height };
}

/**
 * The angle of the text lines, in degrees: positive if they run downhill to
 * the right. Projects the ink onto rows at each candidate angle and keeps
 * the one where rows of text and the gaps between them are sharpest.
 * Rotate by the negative of this to level the text.
 */
export function estimateSkew(img: GrayImage, maxDegrees = 15): number {
  const small =
    Math.max(img.width, img.height) > 800 ? scale(img, 800 / Math.max(img.width, img.height)) : img;
  const mask = inkMask(small);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < small.height; y++) {
    for (let x = 0; x < small.width; x++) {
      if (mask[y * small.width + x]) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 50) return 0;
  const offset = small.width + small.height;
  const bins = new Float64Array(offset * 2 + 1);
  const score = (deg: number) => {
    const t = (deg * Math.PI) / 180;
    const s = Math.sin(t);
    const c = Math.cos(t);
    bins.fill(0);
    for (let i = 0; i < xs.length; i++) bins[Math.round(ys[i] * c - xs[i] * s) + offset]++;
    let sharp = 0;
    for (let i = 1; i < bins.length; i++) sharp += (bins[i] - bins[i - 1]) ** 2;
    return sharp;
  };
  let best = 0;
  let bestScore = -1;
  for (let d = -maxDegrees; d <= maxDegrees; d += 1) {
    const v = score(d);
    if (v > bestScore) [best, bestScore] = [d, v];
  }
  const coarse = best;
  for (let d = coarse - 1; d <= coarse + 1; d += 0.1) {
    const v = score(d);
    if (v > bestScore) [best, bestScore] = [d, v];
  }
  return Math.round(best * 10) / 10;
}

/** Otsu's threshold over a region: the gray level that best splits ink from paper. */
export function otsu(img: GrayImage, box: Box = { x0: 0, y0: 0, x1: img.width, y1: img.height }): number {
  const hist = new Array<number>(256).fill(0);
  let n = 0;
  for (let y = Math.max(0, box.y0 | 0); y < Math.min(img.height, box.y1); y++) {
    for (let x = Math.max(0, box.x0 | 0); x < Math.min(img.width, box.x1); x++) {
      hist[img.data[y * img.width + x]]++;
      n++;
    }
  }
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (between > best) [best, threshold] = [between, t];
  }
  return threshold;
}

/**
 * Typical stroke thickness of the ink in a box, in pixels: for each ink
 * pixel the shorter of its horizontal and vertical runs, then the median.
 * Bold type has thicker strokes than regular type at the same size, so
 * comparing two words' strokes tells which one is bold.
 */
export function strokeWidth(img: GrayImage, box: Box, threshold = otsu(img, box)): number {
  const x0 = Math.max(0, Math.floor(box.x0));
  const y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(img.width, Math.ceil(box.x1));
  const y1 = Math.min(img.height, Math.ceil(box.y1));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return 0;
  const ink = (x: number, y: number) => img.data[(y0 + y) * img.width + x0 + x] <= threshold;
  const hRun = new Uint16Array(w * h);
  const vRun = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!ink(x, y)) {
        x++;
        continue;
      }
      let e = x;
      while (e < w && ink(e, y)) e++;
      for (let k = x; k < e; k++) hRun[y * w + k] = e - x;
      x = e;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!ink(x, y)) {
        y++;
        continue;
      }
      let e = y;
      while (e < h && ink(x, e)) e++;
      for (let k = y; k < e; k++) vRun[k * w + x] = e - y;
      y = e;
    }
  }
  const runs: number[] = [];
  for (let i = 0; i < w * h; i++) if (hRun[i]) runs.push(Math.min(hRun[i], vRun[i]));
  if (!runs.length) return 0;
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)];
}
