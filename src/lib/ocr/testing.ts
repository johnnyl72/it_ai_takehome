/** Builds OCR-shaped data from plain lines of text, for tests. */
import type { LabelReading, OcrLine, WarningReading } from "./types";

export function ocrLines(texts: string[], lineHeight = 30): OcrLine[] {
  return texts.map((text, i) => {
    const y0 = i * lineHeight * 1.5;
    let x = 0;
    const words = text.split(" ").map((w) => {
      const word = {
        text: w,
        confidence: 95,
        bbox: { x0: x, y0, x1: x + w.length * 12, y1: y0 + lineHeight },
      };
      x += w.length * 12 + 10;
      return word;
    });
    return { text, confidence: 95, bbox: { x0: 0, y0, x1: x, y1: y0 + lineHeight }, words };
  });
}

export function readingOf(texts: string[], warning: Partial<WarningReading> = {}): LabelReading {
  return {
    passes: [ocrLines(texts)],
    lines: texts,
    meanConfidence: 95,
    imageQuality: "good",
    imageIssues: "",
    textFound: true,
    straightenedBy: 0,
    warning: {
      text: null,
      heading_bold: "yes",
      boldRatio: 1.5,
      rest_bold: "unclear",
      prominence: "clear",
      fully_legible: true,
      uncertain: [],
      ...warning,
    },
  };
}
