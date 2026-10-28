"use client";

import { useEffect, useState } from "react";
import { warmUp } from "@/lib/client/ocr";

/**
 * Loads the text reader as soon as the app opens, so the first check doesn't
 * wait for it, and shows one plain banner if it can't load at all.
 */
export function ReaderStatus() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    warmUp().catch((e) => {
      console.error("Text reader failed to load:", e);
      setFailed(true);
    });
  }, []);

  if (!failed) return null;
  return (
    <div role="alert" className="border-b-4 border-fail bg-fail-soft">
      <p className="mx-auto max-w-6xl px-4 py-3 text-lg sm:px-6">
        The text reader couldn&apos;t load, so labels can&apos;t be checked. Refresh the page. If it keeps
        happening, the network may be blocking this site&apos;s{" "}
        <strong className="font-semibold">/ocr</strong> files.
      </p>
    </div>
  );
}
