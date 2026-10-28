import type { Block } from "tesseract.js";
import type { Layout, OcrLine } from "./types";

/**
 * Tesseract page segmentation modes. Labels are sparse text in mixed sizes,
 * which the default single-block mode handles badly: it drops big brand
 * names. "auto" finds the layout and catches big type; "sparse" catches
 * stray single words "auto" skips; "block" is for the zoomed-in warning.
 */
export const PSM: Record<Layout, string> = { auto: "3", sparse: "11", block: "6" };

/**
 * Parameters for each read. The images handed over carry no resolution, and
 * Tesseract's guess (it says "25 dpi") wrecks its layout analysis; label art
 * and phone photos at this working size are close to 300.
 */
export const paramsFor = (layout: Layout) => ({
  tessedit_pageseg_mode: PSM[layout],
  user_defined_dpi: "300",
});

/** A box border or rule read as a "word" ("|", "_", "—"): no letters, digits or brackets. */
const isMark = (text: string) => !/[\p{L}\p{N}()]/u.test(text);

export function linesFromBlocks(blocks: Block[] | null): OcrLine[] {
  return (blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) =>
      p.lines
        .map((l) => ({
          text: l.text.trim(),
          confidence: l.confidence,
          bbox: l.bbox,
          words: l.words
            .filter((w) => w.text.trim() && !isMark(w.text))
            .map((w) => ({ text: w.text.trim(), confidence: w.confidence, bbox: w.bbox })),
        }))
        .filter((l) => l.words.length),
    ),
  );
}
