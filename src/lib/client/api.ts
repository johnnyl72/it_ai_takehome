import { compareLabel } from "../compare";
import { readLabel } from "../ocr/pipeline";
import type { Application, VerificationResult } from "../types";
import { ImageError, loadGray } from "./image";
import { ENGINE, withReader } from "./ocr";

export class CheckError extends Error {}

/**
 * Checks one label, entirely in this browser: the image is read here and
 * never uploaded anywhere.
 */
export async function checkLabel(
  file: File,
  application: Application,
  signal?: AbortSignal,
): Promise<VerificationResult> {
  const started = performance.now();
  let gray;
  try {
    gray = await loadGray(file);
  } catch (e) {
    throw new CheckError(e instanceof ImageError ? e.message : `"${file.name}" couldn't be opened.`);
  }
  // A label already being read finishes; stopping only skips the ones not started.
  signal?.throwIfAborted();

  let reading;
  try {
    reading = await withReader((recognize) => readLabel(gray, recognize));
  } catch (e) {
    console.error("Text reader failed:", e);
    throw new CheckError("The text reader couldn't start. Refresh the page and try again.");
  }
  const ms = Math.round(performance.now() - started);
  return compareLabel(application, reading, { totalMs: ms, readMs: ms }, ENGINE);
}
