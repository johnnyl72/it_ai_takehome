/** A grayscale image: one byte per pixel, 0 = black, 255 = white. */
export interface GrayImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrWord {
  text: string;
  /** Tesseract's confidence, 0 to 100. */
  confidence: number;
  bbox: Box;
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: Box;
  words: OcrWord[];
}

/** Tesseract page segmentation modes this app uses. */
export type Layout = "auto" | "sparse" | "block";

/** Reads one image. Injected, so the browser and the Node eval share the pipeline. */
export type Recognize = (image: GrayImage, layout: Layout) => Promise<OcrLine[]>;

export interface WarningReading {
  /** The statement as read, heading included, or null if none was found. */
  text: string | null;
  heading_bold: "yes" | "no" | "unclear";
  /** Heading stroke thickness over body stroke thickness: the evidence for heading_bold. */
  boldRatio: number | null;
  rest_bold: "yes" | "no" | "unclear";
  prominence: "clear" | "small" | "buried";
  fully_legible: boolean;
  /** Words the reader wasn't sure of: a difference in one of these is probably a misread. */
  uncertain: string[];
}

export interface LabelReading {
  /** Each reading pass in reading order. Fields are searched in all of them. */
  passes: OcrLine[][];
  /** Everything read, one line per entry, for the agent to see. */
  lines: string[];
  meanConfidence: number;
  imageQuality: "good" | "fair" | "poor";
  /** Plain description of what made the image hard to read; "" if nothing. */
  imageIssues: string;
  /** False if almost no readable text was found. */
  textFound: boolean;
  /** Degrees the image was rotated to level the text. */
  straightenedBy: number;
  warning: WarningReading;
}
