/**
 * Turns a label image into what the comparison needs: the text, read two
 * ways, and facts about the government warning that OCR alone doesn't give
 * (is the heading bold, is the print tiny). Pure code with the OCR engine
 * injected, so the browser and the Node eval run the same steps.
 */
import { loose, similarity } from "../normalize";
import { binarize, crop, estimateSkew, otsu, rotate, scale, strokeWidth } from "./image";
import type { Box, GrayImage, LabelReading, OcrLine, OcrWord, Recognize, WarningReading } from "./types";

/** Long edge to read at. Bigger reads fine print better but takes longer. */
const WORK_EDGE = 2400;
const MIN_EDGE = 1200;
/** Height, in pixels, the warning's words are zoomed to before the second read. */
const ZOOM_WORD_HEIGHT = 42;
/** Below this confidence a word is treated as unsure, so a difference in it is probably a misread. */
const UNSURE = 80;

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};
const height = (b: Box) => b.y1 - b.y0;
const union = (boxes: Box[]): Box => ({
  x0: Math.min(...boxes.map((b) => b.x0)),
  y0: Math.min(...boxes.map((b) => b.y0)),
  x1: Math.max(...boxes.map((b) => b.x1)),
  y1: Math.max(...boxes.map((b) => b.y1)),
});
/** Real words, not stray marks: 3+ characters. */
const wordish = (w: OcrWord) => loose(w.text).replace(/ /g, "").length >= 3;

function isHeadingAt(words: OcrWord[], i: number): boolean {
  if (i + 1 >= words.length) return false;
  return similarity(`${words[i].text} ${words[i + 1].text}`, "government warning") >= 0.75;
}

const NO_WARNING: WarningReading = {
  text: null,
  heading_bold: "unclear",
  boldRatio: null,
  rest_bold: "unclear",
  prominence: "clear",
  fully_legible: true,
  uncertain: [],
};

interface Found {
  lines: OcrLine[];
  region: Box;
}

/** The warning's lines: from the heading down until "health problems". */
function findWarning(passes: OcrLine[][]): Found | null {
  let best: { lines: OcrLine[]; at: number; confidence: number } | null = null;
  for (const lines of passes) {
    const at = lines.findIndex((l) => l.words.some((_, i) => isHeadingAt(l.words, i)));
    if (at < 0) continue;
    if (!best || lines[at].confidence > best.confidence)
      best = { lines, at, confidence: lines[at].confidence };
  }
  if (!best) return null;
  const { lines, at } = best;
  const taken = [lines[at]];
  for (let i = at + 1; i < lines.length && taken.length < 8; i++) {
    const prev = taken[taken.length - 1];
    if (/problems/i.test(prev.text)) break;
    const gap = lines[i].bbox.y0 - prev.bbox.y1;
    if (gap > 1.5 * height(prev.bbox) || gap < -height(prev.bbox)) break;
    taken.push(lines[i]);
  }
  const words = taken.flatMap((l) => l.words).filter(wordish);
  const pad = 0.8 * (median(words.map((w) => height(w.bbox))) || 20);
  const box = union(taken.map((l) => l.bbox));
  return { lines: taken, region: { x0: box.x0 - pad, y0: box.y0 - pad, x1: box.x1 + pad, y1: box.y1 + pad } };
}

/** Joins words across line breaks, mending words hyphenated at the end of a line. */
function joinWords(lines: OcrLine[]): OcrWord[] {
  const out: OcrWord[] = [];
  for (const line of lines) {
    for (const [i, w] of line.words.entries()) {
      const prev = out[out.length - 1];
      if (i === 0 && prev && /[a-z]-$/.test(prev.text) && /^[a-z]/.test(w.text)) {
        out[out.length - 1] = {
          text: prev.text.slice(0, -1) + w.text,
          confidence: Math.min(prev.confidence, w.confidence),
          bbox: prev.bbox,
        };
      } else {
        out.push(w);
      }
    }
  }
  return out;
}

/** The statement's own words: from the heading to "problems.", nothing around it. */
function statementWords(words: OcrWord[]): OcrWord[] {
  const start = words.findIndex((_, i) => isHeadingAt(words, i));
  if (start < 0) return [];
  const rest = words.slice(start);
  const end = rest.findLastIndex((w) => loose(w.text) === "problems");
  return end >= 0 ? rest.slice(0, end + 1) : rest;
}

/** Heading heavier than the text after it? Compares stroke thickness on the same line. */
function headingWeight(
  img: GrayImage,
  lines: OcrLine[],
  clear: boolean,
): Pick<WarningReading, "heading_bold" | "boldRatio"> {
  const unclear = { heading_bold: "unclear" as const, boldRatio: null };
  const first = lines.find((l) => l.words.some((_, i) => isHeadingAt(l.words, i)));
  if (!first) return unclear;
  const at = first.words.findIndex((_, i) => isHeadingAt(first.words, i));
  const heading = first.words.slice(at, at + 2);
  let body = first.words.slice(at + 2).filter(wordish);
  if (body.length < 3) body = [...body, ...(lines[lines.indexOf(first) + 1]?.words.filter(wordish) ?? [])];
  if (body.length < 2) return unclear;
  const t = otsu(img, union([...heading, ...body].map((w) => w.bbox)));
  const h = median(heading.map((w) => strokeWidth(img, w.bbox, t)));
  const b = median(body.slice(0, 8).map((w) => strokeWidth(img, w.bbox, t)));
  if (!h || !b) return unclear;
  const boldRatio = Math.round((h / b) * 100) / 100;
  if (boldRatio >= 1.3) return { heading_bold: "yes", boldRatio };
  // Blur thickens thin strokes, so only call it "not bold" on a clear read.
  if (boldRatio <= 1.1 && clear) return { heading_bold: "no", boldRatio };
  return { heading_bold: "unclear", boldRatio };
}

async function readWarning(
  img: GrayImage,
  imgScale: number,
  found: Found,
  others: OcrLine[],
  recognize: Recognize,
  imageClear: boolean,
): Promise<WarningReading> {
  // Zoom in on the fine print, like an agent with a magnifier, and read it again.
  const words = found.lines.flatMap((l) => l.words).filter(wordish);
  const wordHeight = median(words.map((w) => height(w.bbox))) || 20;
  const zoom = Math.min(4, Math.max(1, ZOOM_WORD_HEIGHT / wordHeight));
  const zoomed = scale(crop(img, found.region), zoom);
  const zoomLines = await recognize(zoomed, "block");

  let statement = statementWords(joinWords(zoomLines));
  let measuredOn = { img: zoomed, lines: zoomLines };
  if (!statement.length) {
    statement = statementWords(joinWords(found.lines));
    measuredOn = { img, lines: found.lines };
  }
  if (!statement.length) {
    return { ...NO_WARNING, fully_legible: false };
  }

  const conf = statement.map((w) => w.confidence);
  const meanConf = conf.reduce((a, b) => a + b, 0) / conf.length;
  const fullyLegible = meanConf >= 70 && conf.filter((c) => c < 50).length <= conf.length * 0.1;

  // Tiny print: the warning's letters against the label's own small print
  // (25th percentile, so one tiny lot-number stamp doesn't set the bar).
  const warningHeight = wordHeight / imgScale;
  const otherHeights = others
    .map((l) => median(l.words.filter((w) => wordish(w) && w.confidence >= 60).map((w) => height(w.bbox))))
    .filter((h) => h > 0);
  const smallPrint = quantile(otherHeights, 0.25);
  const prominence = smallPrint && warningHeight < 0.5 * smallPrint ? "small" : "clear";

  return {
    text: statement.map((w) => w.text).join(" "),
    ...headingWeight(measuredOn.img, measuredOn.lines, imageClear && meanConf >= 85),
    // Only the heading may be bold; telling an all-bold statement apart isn't reliable, so it's never claimed.
    rest_bold: "unclear",
    prominence,
    fully_legible: fullyLegible,
    uncertain: statement.filter((w) => w.confidence < UNSURE).map((w) => w.text),
  };
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export async function readLabel(input: GrayImage, recognize: Recognize): Promise<LabelReading> {
  const long = Math.max(input.width, input.height);
  let img =
    long > WORK_EDGE
      ? scale(input, WORK_EDGE / long)
      : long < MIN_EDGE
        ? scale(input, MIN_EDGE / long)
        : input;

  // Photos taken at an angle read badly until the text is level.
  const skew = estimateSkew(img);
  if (Math.abs(skew) >= 0.5) img = rotate(img, -skew);

  const auto = await recognize(img, "auto");
  const sparse = await recognize(img, "sparse");
  const passes = [auto, sparse];

  const words = auto.flatMap((l) => l.words).filter(wordish);
  const confidence = words.length ? words.reduce((a, w) => a + w.confidence, 0) / words.length : 0;
  // A photo (tilted, or not crisp) gets a third read with glare and shading
  // evened out; whatever it reads adds to what the first two found.
  if (Math.abs(skew) >= 1 || confidence < 90) passes.push(await recognize(binarize(img), "auto"));

  const meanConfidence = words.length ? words.reduce((a, w) => a + w.confidence, 0) / words.length : 0;
  const imageQuality = meanConfidence >= 85 ? "good" : meanConfidence >= 70 ? "fair" : "poor";
  const textFound =
    [...auto, ...sparse].flatMap((l) => l.words).filter((w) => wordish(w) && w.confidence >= 50).length >= 5;

  // Warning print can be too small to find at all at this size; look again at double size.
  let found = findWarning(passes);
  let warningImg = img;
  let warningScale = 1;
  if (!found && textFound) {
    const big = scale(img, 2);
    const bigLines = await recognize(big, "auto");
    found = findWarning([bigLines]);
    if (found) [warningImg, warningScale] = [big, 2];
  }

  const others = found
    ? passes
        .flat()
        .filter(
          (l) => !found.lines.includes(l) && !overlaps(l.bbox, scaleBox(found.region, 1 / warningScale)),
        )
    : passes.flat();
  const warning: WarningReading = found
    ? await readWarning(warningImg, warningScale, found, others, recognize, imageQuality !== "poor")
    : { ...NO_WARNING, fully_legible: imageQuality !== "poor" };

  const issues = [
    Math.abs(skew) >= 1.5 && `photographed at an angle, straightened by ${Math.abs(skew).toFixed(0)}°`,
    imageQuality === "poor" && "much of the text is faint, blurred or hidden",
  ].filter(Boolean);

  return {
    passes,
    lines: auto.map((l) => l.text),
    meanConfidence: Math.round(meanConfidence),
    imageQuality,
    imageIssues: issues.join("; "),
    textFound,
    straightenedBy: -skew,
    warning,
  };
}

function scaleBox(b: Box, f: number): Box {
  return { x0: b.x0 * f, y0: b.y0 * f, x1: b.x1 * f, y1: b.y1 * f };
}
