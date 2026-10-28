/**
 * The OCR engine in the browser: a small pool of tesseract.js workers. Each
 * label is read by one worker from start to finish, so a batch runs as many
 * labels at once as there are workers. Everything is served from this app
 * (see scripts/copy-ocr-assets.mjs); nothing is fetched from anywhere else.
 */
import type { Worker } from "tesseract.js";
import { toRgba } from "../ocr/image";
import { linesFromBlocks, paramsFor } from "../ocr/tesseract";
import type { Recognize } from "../ocr/types";

export const ENGINE = "Tesseract OCR";

const ASSETS = {
  workerPath: "/ocr/worker.min.js",
  corePath: "/ocr/core",
  langPath: "/ocr/lang",
  // A blob: worker would need a looser security policy; load it from this site instead.
  workerBlobURL: false,
};

/** Each worker holds the model in memory (~40 MB), so cap it even on big machines. */
export function readerCount(): number {
  const cores = typeof navigator === "undefined" ? 2 : navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(4, cores - 1));
}

let created = 0;
const idle: Worker[] = [];
const waiting: ((w: Worker) => void)[] = [];
let warming: Promise<void> | null = null;

async function spawn(): Promise<Worker> {
  created++;
  try {
    const { createWorker, OEM } = await import("tesseract.js");
    return await createWorker("eng", OEM.LSTM_ONLY, ASSETS);
  } catch (e) {
    created--;
    throw e;
  }
}

function release(w: Worker) {
  const next = waiting.shift();
  if (next) next(w);
  else idle.push(w);
}

async function acquire(): Promise<Worker> {
  if (warming) await warming.catch(() => {});
  const w = idle.pop();
  if (w) return w;
  if (created < readerCount()) return spawn();
  return new Promise((resolve) => waiting.push(resolve));
}

/** Loads the first worker in the background, so the first check doesn't wait for it. */
export function warmUp(): Promise<void> {
  warming ??= spawn().then(release, (e) => {
    warming = null;
    throw e;
  });
  return warming;
}

function recognizer(worker: Worker): Recognize {
  return async (img, layout) => {
    await worker.setParameters(paramsFor(layout) as never);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.putImageData(new ImageData(toRgba(img), img.width, img.height), 0, 0);
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    return linesFromBlocks(data.blocks);
  };
}

export async function withReader<T>(job: (recognize: Recognize) => Promise<T>): Promise<T> {
  const worker = await acquire();
  try {
    return await job(recognizer(worker));
  } finally {
    release(worker);
  }
}
