import { toGray } from "../ocr/image";
import type { GrayImage } from "../ocr/types";

/**
 * Below this, the warning's fine print is a few pixels tall and can't be read,
 * so the image is turned back before any time is spent on it.
 */
const MIN_EDGE = 600;
/** Phone photos are shrunk here first; the canvas does it far faster than plain code. */
const MAX_EDGE = 2400;

export class ImageError extends Error {}

async function openImage(file: File): Promise<ImageBitmap> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError(`"${file.name}" couldn't be opened. Save it as a JPG or PNG and try again.`);
  }
  if (Math.max(bitmap.width, bitmap.height) < MIN_EDGE) {
    const size = `${bitmap.width} × ${bitmap.height} pixels`;
    bitmap.close();
    throw new ImageError(
      `"${file.name}" is too small to read (${size}). Ask for an image at least 1500 pixels on its long side.`,
    );
  }
  return bitmap;
}

/** Throws an ImageError with a plain reason if the image can't be checked. */
export async function preflightImage(file: File): Promise<void> {
  (await openImage(file)).close();
}

export async function loadGray(file: File): Promise<GrayImage> {
  const bitmap = await openImage(file);
  const f = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * f);
  canvas.height = Math.round(bitmap.height * f);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new ImageError("This browser couldn't prepare the image.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return toGray(data, canvas.width, canvas.height);
}

export const isImageFile = (f: File) =>
  f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);
