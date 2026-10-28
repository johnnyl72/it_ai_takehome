/** Hidden system files (.DS_Store and friends) that come along with a folder. */
const isHidden = (f: File) => f.name.startsWith(".");

/**
 * Files from a drop, including everything inside dropped folders: importers
 * send a folder of labels, and the browser only hands over a folder's
 * contents through the entries API. The entries have to be taken before the
 * first await, while the drop event is still live.
 */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return Array.from(dt.files).filter((f) => !isHidden(f));

  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      // readEntries returns at most ~100 at a time; keep asking until it's empty.
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e);
      }
    }
  };
  for (const e of entries) await walk(e);
  return out.filter((f) => !isHidden(f));
}

export const visibleFiles = (list: FileList | null) => Array.from(list ?? []).filter((f) => !isHidden(f));

export async function sha256(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
