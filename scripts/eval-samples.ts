/**
 * Runs every label in the test kit through the same reading pipeline the
 * browser uses, in Node, and compares the verdict with the answer key. Free:
 * no API, no key. Run: npm run eval  (add --verbose for what was read)
 *
 * A wrong verdict is "stricter" when a good label is sent for review (safe,
 * the agent looks) and "LOOSER" when a bad label gets through (unsafe).
 * Any looser result fails the run.
 */
import path from "node:path";
import sharp from "sharp";
import { createWorker, OEM } from "tesseract.js";
import { compareLabel } from "../src/lib/compare";
import { toGray } from "../src/lib/ocr/image";
import { readLabel } from "../src/lib/ocr/pipeline";
import { linesFromBlocks, paramsFor } from "../src/lib/ocr/tesseract";
import type { GrayImage, Recognize } from "../src/lib/ocr/types";
import { TEST_KIT, type KitResult } from "../src/lib/samples";
import { EMPTY_APPLICATION } from "../src/lib/types";

const verbose = process.argv.includes("--verbose");
const TARGET_MS = 5000;
const RANK = { pass: 0, review: 1, fail: 2 } as const;
const VERDICT: Partial<Record<KitResult, keyof typeof RANK>> = {
  Match: "pass",
  Review: "review",
  Problem: "fail",
};
/** The browser turns back anything smaller before reading it (src/lib/client/image.ts). */
const MIN_EDGE = 600;

async function loadGray(file: string): Promise<GrayImage> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return toGray(data, info.width, info.height);
}

async function main() {
  const langPath = path.resolve("node_modules/@tesseract.js-data/eng/4.0.0_best_int");
  const worker = await createWorker("eng", OEM.LSTM_ONLY, { langPath, cacheMethod: "none" });
  const recognize: Recognize = async (img, layout) => {
    await worker.setParameters(paramsFor(layout) as never);
    const png = await sharp(Buffer.from(img.data), {
      raw: { width: img.width, height: img.height, channels: 1 },
    })
      .png()
      .toBuffer();
    const { data } = await worker.recognize(png, {}, { blocks: true });
    return linesFromBlocks(data.blocks);
  };

  const times: number[] = [];
  let looser = 0;
  let exact = 0;
  // Copies repeat their original, and a missing image has nothing to read.
  const entries = TEST_KIT.filter((e) => e.hasImage && !e.copyOf);
  for (const e of entries) {
    const file = `public/test-kit/labels/${e.file}`;
    const { width = 0, height = 0 } = await sharp(file).metadata();
    if (Math.max(width, height) < MIN_EDGE) {
      const ok = e.expected === "Couldn't check";
      if (ok) exact++;
      else looser++;
      console.log(`${ok ? "exact  " : "LOOSER "} ${e.file.padEnd(32)} turned back: ${width} × ${height}`);
      continue;
    }
    const want = VERDICT[e.expected]!;
    const started = Date.now();
    const reading = await readLabel(await loadGray(file), recognize);
    const ms = Date.now() - started;
    times.push(ms);
    // An image with no CSV row gets the warning check only.
    const application = e.csvName ? e.sample.application : EMPTY_APPLICATION;
    const result = compareLabel(application, reading, { totalMs: ms, readMs: ms }, "tesseract");
    const diff = RANK[result.verdict] - RANK[want];
    const tag = diff === 0 ? "exact  " : diff > 0 ? "stricter" : "LOOSER ";
    if (diff === 0) exact++;
    if (diff < 0) looser++;
    const w = reading.warning;
    console.log(
      `${tag} ${e.file.padEnd(32)} expected ${want.padEnd(6)} got ${result.verdict.padEnd(6)} ${(ms / 1000).toFixed(1)} s  ` +
        `[conf ${reading.meanConfidence} ${reading.imageQuality}, straightened ${reading.straightenedBy}°, bold ${w.heading_bold} ${w.boldRatio ?? "-"}, ${w.prominence}]`,
    );
    if (diff !== 0 || verbose) {
      for (const c of result.checks.filter((c) => c.status !== "skipped" && c.status !== "pass")) {
        console.log(
          `           ${c.status.toUpperCase()} ${c.label}: ${c.note}  (label says: ${c.found ?? "-"})`,
        );
      }
    }
    if (verbose)
      console.log(`           warning read: ${w.text}\n           lines: ${reading.lines.join(" | ")}`);
  }
  await worker.terminate();

  const sorted = [...times].sort((a, b) => a - b);
  console.log(
    `\n${exact}/${entries.length} exact, ${looser} looser than expected. Time per label: median ${(sorted[Math.floor(sorted.length / 2)] / 1000).toFixed(1)} s, slowest ${(sorted.at(-1)! / 1000).toFixed(1)} s, ${times.filter((t) => t > TARGET_MS).length} over 5 s.`,
  );
  process.exit(looser ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
