/**
 * One object URL per file, created on first use. Safe to call during render:
 * the same file always returns the same URL. Release it when the file is
 * dropped, so the browser can free the image.
 */
const urls = new WeakMap<Blob, string>();

export function objectUrl(blob: Blob): string {
  let url = urls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    urls.set(blob, url);
  }
  return url;
}

export function releaseObjectUrl(blob: Blob) {
  const url = urls.get(blob);
  if (url) {
    URL.revokeObjectURL(url);
    urls.delete(blob);
  }
}
