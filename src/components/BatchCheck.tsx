"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { checkLabel } from "@/lib/client/api";
import { sha256 } from "@/lib/client/files";
import { isImageFile } from "@/lib/client/image";
import { readerCount } from "@/lib/client/ocr";
import { objectUrl, releaseObjectUrl } from "@/lib/client/objectUrl";
import { CSV_HEADERS, fileKey, parseApplicationsCsv, resultsToCsv, type ParsedCsv } from "@/lib/csv";
import { reconcile } from "@/lib/reconcile";
import { SAMPLES, sampleImageUrl } from "@/lib/samples";
import { EMPTY_APPLICATION, type Application, type VerificationResult } from "@/lib/types";
import { DropZone } from "./DropZone";
import { ResultView } from "./ResultView";
import { StatusMark } from "./StatusMark";

const MAX_FILES = 500;

interface ImageEntry {
  file: File;
  name: string;
  hash: string;
}

interface Item {
  name: string;
  /** null: an application row with no label image. */
  file: File | null;
  application: Application | null;
  duplicateOf: string | null;
  state: "waiting" | "checking" | "done" | "error" | "missing";
  result?: VerificationResult;
  error?: string;
}

type Filter = "all" | "fail" | "review" | "pass" | "error" | "missing";

/** Worst first, for "Show problems first". */
const SEVERITY: Record<string, number> = { fail: 0, error: 1, missing: 2, review: 3, pass: 4, pending: 5 };
const severity = (it: Item) =>
  SEVERITY[it.result?.verdict ?? (it.state === "error" || it.state === "missing" ? it.state : "pending")];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listUpTo = (names: string[], max = 5) => (names.length <= max ? `: ${names.join(", ")}` : "");

export function BatchCheck() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [csv, setCsv] = useState<(ParsedCsv & { name: string }) | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<{ started: number; finished: number | null; doneAtStart: number } | null>(
    null,
  );
  const [now, setNow] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [problemsFirst, setProblemsFirst] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const rec = useMemo(() => reconcile(images, csv?.rows ?? null), [images, csv]);

  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Closing the tab would throw away a half-finished batch.
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => {
      clearInterval(tick);
      window.removeEventListener("beforeunload", warn);
    };
  }, [running]);

  function replaceImages(next: ImageEntry[]) {
    const keep = new Set(next.map((e) => e.file));
    images.filter((e) => !keep.has(e.file)).forEach((e) => releaseObjectUrl(e.file));
    setImages(next);
    setItems([]);
    setRun(null);
  }

  async function addImages(files: File[]) {
    const ok = files.filter(isImageFile);
    const msgs: string[] = [];
    const skipped = files.length - ok.length;
    if (skipped)
      msgs.push(
        `${plural(skipped, "file")} skipped because ${skipped === 1 ? "it isn't an image" : "they aren't images"}.`,
      );
    setAdding(true);
    const entries = await Promise.all(
      ok.map(async (file) => ({ file, name: file.name, hash: await sha256(file) })),
    );
    setAdding(false);

    const byName = new Map(images.map((e) => [fileKey(e.name), e]));
    let replaced = 0;
    for (const e of entries) {
      if (byName.has(fileKey(e.name))) replaced++;
      byName.set(fileKey(e.name), e);
    }
    if (replaced) msgs.push(`${plural(replaced, "image")} replaced an earlier one with the same name.`);
    let all = [...byName.values()];
    if (all.length > MAX_FILES) {
      msgs.push(`Only the first ${MAX_FILES} images were kept. Split larger batches into parts.`);
      all = all.slice(0, MAX_FILES);
    }
    setNotices(msgs);
    replaceImages(all);
  }

  async function addCsv(files: File[]) {
    const f = files[0];
    if (!/\.csv$/i.test(f.name) && f.type !== "text/csv") {
      setNotices([
        `"${f.name}" isn't a CSV file. In the spreadsheet, use Save As and choose CSV, then try again.`,
      ]);
      return;
    }
    setCsv({ ...parseApplicationsCsv(await f.text()), name: f.name });
    setNotices([]);
    setItems([]);
    setRun(null);
  }

  async function loadExample() {
    setNotices([]);
    try {
      const files = await Promise.all(
        SAMPLES.map(async (s) => {
          const blob = await (await fetch(sampleImageUrl(s))).blob();
          const file = new File([blob], `${s.id}.jpg`, { type: "image/jpeg" });
          return { file, name: file.name, hash: await sha256(file) };
        }),
      );
      const text = await (await fetch("/samples/sample-batch.csv")).text();
      replaceImages(files);
      setCsv({ ...parseApplicationsCsv(text), name: "sample-batch.csv" });
    } catch {
      setNotices(["The example batch couldn't be loaded. Check your connection."]);
    }
  }

  function update(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  }

  async function process(list: Item[], queue: number[]) {
    const ctrl = new AbortController();
    abort.current = ctrl;
    const started = Date.now();
    setRun({ started, finished: null, doneAtStart: list.filter((i) => i.state === "done").length });
    setNow(started);
    setRunning(true);
    let next = 0;

    const worker = async () => {
      while (!ctrl.signal.aborted && next < queue.length) {
        const i = queue[next++];
        update(i, { state: "checking", error: undefined });
        try {
          const result = await checkLabel(
            list[i].file!,
            list[i].application ?? EMPTY_APPLICATION,
            ctrl.signal,
          );
          update(i, { state: "done", result });
        } catch (e) {
          if (ctrl.signal.aborted) {
            update(i, { state: "waiting" });
            return;
          }
          update(i, { state: "error", error: e instanceof Error ? e.message : "Couldn't check this label." });
        }
      }
    };

    // One label per text reader at a time; the reader pool sets how many run at once.
    await Promise.all(Array.from({ length: readerCount() }, worker));
    setRunning(false);
    setRun((r) => (r ? { ...r, finished: Date.now() } : r));
  }

  function start() {
    const list: Item[] = [
      ...rec.pairs.map((p) => ({
        name: p.image.name,
        file: p.image.file,
        application: p.row?.application ?? null,
        duplicateOf: p.duplicateOf,
        state: "waiting" as const,
      })),
      ...rec.rowsWithoutImage.map((r) => ({
        name: r.name,
        file: null,
        application: r.application,
        duplicateOf: null,
        state: "missing" as const,
        error: `No label image was added for this application (CSV row ${r.line}).`,
      })),
    ];
    setItems(list);
    setFilter("all");
    setOpen(null);
    process(
      list,
      list.flatMap((it, i) => (it.file ? [i] : [])),
    );
  }

  function resume() {
    process(
      items,
      items.flatMap((it, i) => (it.state === "waiting" || it.state === "error" ? [i] : [])),
    );
  }

  const labels = items.filter((i) => i.file);
  const counts = {
    done: labels.filter((i) => i.state === "done" || i.state === "error").length,
    fail: items.filter((i) => i.result?.verdict === "fail").length,
    review: items.filter((i) => i.result?.verdict === "review").length,
    pass: items.filter((i) => i.result?.verdict === "pass").length,
    error: items.filter((i) => i.state === "error").length,
    missing: items.filter((i) => i.state === "missing").length,
  };
  const leftover = items.filter((i) => i.state === "waiting" || i.state === "error").length;

  let timeLeft: string | null = null;
  if (running && run) {
    const doneThisRun = items.filter((i) => i.state === "done").length - run.doneAtStart;
    const remaining = items.filter((i) => i.state === "waiting" || i.state === "checking").length;
    // Wait for a few results before estimating, or the first guess swings wildly.
    if (doneThisRun >= readerCount() && now > run.started) {
      const ms = (remaining * (now - run.started)) / doneThisRun;
      timeLeft = ms < 60_000 ? "Less than a minute left." : `About ${Math.round(ms / 60_000)} min left.`;
    }
  }

  const shown = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) =>
      filter === "all"
        ? true
        : filter === "error" || filter === "missing"
          ? it.state === filter
          : it.result?.verdict === filter,
    )
    .sort((a, b) => (problemsFirst ? severity(a.it) - severity(b.it) || a.i - b.i : a.i - b.i));

  const c = rec.counts;
  const noRow = rec.pairs.filter((p) => !p.row).map((p) => p.image.name);
  const dupes = rec.pairs
    .filter((p) => p.duplicateOf)
    .map((p) => `${p.image.name} is the same as ${p.duplicateOf}`);

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">Check a batch of labels</h1>
        <p className="mt-2 text-lg">
          For importers who send hundreds of labels at once. Add the images and a spreadsheet of what each
          application says, then check them all in one go.
        </p>
        <p className="mt-2">
          <button
            type="button"
            onClick={loadExample}
            disabled={running}
            className="text-lg text-blue underline underline-offset-2"
          >
            Load the example batch ({SAMPLES.length} labels)
          </button>
        </p>
      </div>

      {notices.length > 0 && (
        <div role="status" className="rounded-md border-l-8 border-review bg-review-soft p-4">
          {notices.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      <ol className="grid gap-6 lg:grid-cols-2">
        <li className="space-y-3">
          <h2 className="text-xl font-bold">1. Add the label images</h2>
          <DropZone
            onFiles={addImages}
            multiple
            folder
            disabled={running || adding}
            accept="image/*"
            buttonText={images.length ? "Add more images" : "Choose label images"}
            hint={
              adding
                ? "Adding images…"
                : images.length
                  ? `${plural(images.length, "image")} added. You can add more in parts.`
                  : `or drag files or a folder here. Up to ${MAX_FILES} at a time.`
            }
          />
          {images.length > 0 && !running && (
            <button
              type="button"
              onClick={() => replaceImages([])}
              className="text-blue underline underline-offset-2"
            >
              Remove all images
            </button>
          )}
        </li>
        <li className="space-y-3">
          <h2 className="text-xl font-bold">2. Add the application details</h2>
          <DropZone
            onFiles={addCsv}
            disabled={running}
            accept=".csv,text/csv"
            buttonText={csv ? "Choose a different CSV" : "Choose CSV file"}
            hint={
              csv
                ? `${csv.name}: ${plural(csv.rows.size, "application")}.`
                : "One row per label, matched to the images by file name."
            }
          />
          <p className="text-muted">
            Columns: {CSV_HEADERS.join(", ")}.{" "}
            <button
              type="button"
              onClick={() => download("label-check-template.csv", CSV_HEADERS.join(",") + "\n")}
              className="text-blue underline underline-offset-2"
            >
              Download a blank template
            </button>
          </p>
        </li>
      </ol>

      {(images.length > 0 || csv) && (
        <section
          aria-labelledby="ready"
          className="space-y-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-line-soft sm:p-6"
        >
          <h2 id="ready" className="text-xl font-bold">
            3. Check what matched, then check the labels
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-line-soft p-4">
              <h3 className="font-semibold">Label images: {c.images}</h3>
              <ul className="mt-1 space-y-1">
                <li>
                  {c.matched} matched to an application
                  {c.matchedIgnoringExtension
                    ? ` (${c.matchedIgnoringExtension} by name, ignoring a different file extension)`
                    : ""}
                </li>
                {c.imagesWithoutRow > 0 && (
                  <li className="text-review">
                    {c.imagesWithoutRow} with no application row
                    {csv ? listUpTo(noRow) : " because no CSV was added"}. Only the government warning will be
                    checked.
                  </li>
                )}
                {c.duplicates > 0 && (
                  <li className="text-review">
                    {plural(c.duplicates, "image is an exact copy", "images are exact copies")} of another
                    {c.duplicates <= 3 ? `: ${dupes.join("; ")}` : ""}.
                  </li>
                )}
              </ul>
            </div>
            <div className="rounded-md border border-line-soft p-4">
              {csv ? (
                <>
                  <h3 className="font-semibold">Applications in the CSV: {c.rows}</h3>
                  <ul className="mt-1 space-y-1">
                    <li>{c.matched} matched to an image</li>
                    {c.rowsWithoutImage > 0 && (
                      <li className="text-fail">
                        {c.rowsWithoutImage} with no image
                        {listUpTo(rec.rowsWithoutImage.map((r) => r.name))}. Listed as &ldquo;Missing
                        image&rdquo; in the results.
                      </li>
                    )}
                    {csv.problems.map((p) => (
                      <li key={p} className="text-review">
                        {p}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <h3 className="font-semibold">No CSV added</h3>
                  <p className="mt-1">Without application details, each label gets the warning check only.</p>
                </>
              )}
            </div>
          </div>

          {running ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="rounded-md border-2 border-fail bg-white px-6 py-3 text-lg font-semibold text-fail hover:bg-fail-soft"
            >
              Stop checking
            </button>
          ) : items.length && leftover ? (
            <button
              type="button"
              onClick={resume}
              className="rounded-md bg-blue px-6 py-3 text-lg font-bold text-white hover:bg-blue-dark"
            >
              Check the remaining {plural(leftover, "label")}
            </button>
          ) : images.length ? (
            <button
              type="button"
              onClick={start}
              className="rounded-md bg-blue px-6 py-3 text-lg font-bold text-white hover:bg-blue-dark"
            >
              {items.length ? "Check all again" : `Check ${plural(images.length, "label")}`}
            </button>
          ) : null}

          {labels.length > 0 && (
            <div className="space-y-2">
              <label htmlFor="progress" className="block font-semibold">
                Checked {counts.done} of {labels.length}
              </label>
              <progress
                id="progress"
                value={counts.done}
                max={labels.length}
                className="h-4 w-full accent-blue"
              />
              <p aria-live="polite" className="text-muted">
                {counts.fail} with problems, {counts.review} to review, {counts.pass} matching
                {counts.error ? `, ${counts.error} couldn't be checked` : ""}
                {counts.missing ? `, ${counts.missing} missing an image` : ""}.{" "}
                {running
                  ? timeLeft
                  : run?.finished && !leftover
                    ? `Finished: ${plural(labels.length, "label")} checked in ${duration(run.finished - run.started)}.`
                    : ""}
              </p>
            </div>
          )}
        </section>
      )}

      {items.length > 0 && (
        <section aria-labelledby="results" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="results" className="text-2xl font-bold">
              Results
            </h2>
            <button
              type="button"
              disabled={!counts.done && !counts.missing}
              onClick={() =>
                download(
                  "label-check-results.csv",
                  resultsToCsv(
                    items.map((it) => ({
                      file: it.name,
                      result: it.result,
                      status: it.state === "missing" ? "Missing image" : "Not checked",
                      note: it.error ?? (it.duplicateOf ? `Same image as ${it.duplicateOf}` : ""),
                    })),
                  ),
                )
              }
              className="rounded-md border-2 border-blue bg-white px-5 py-2.5 font-semibold text-blue hover:bg-blue-soft disabled:opacity-50"
            >
              Download results (CSV)
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
              {(
                [
                  ["all", `All (${items.length})`],
                  ["fail", `Problems (${counts.fail})`],
                  ["review", `Review (${counts.review})`],
                  ["pass", `Matches (${counts.pass})`],
                  ["error", `Couldn't check (${counts.error})`],
                  ...(counts.missing ? [["missing", `Missing image (${counts.missing})`]] : []),
                ] as [Filter, string][]
              ).map(([f, text]) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border-2 px-4 py-1.5 font-semibold ${
                    filter === f
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-white text-ink hover:border-navy"
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-lg">
              <input
                type="checkbox"
                checked={problemsFirst}
                onChange={(e) => setProblemsFirst(e.target.checked)}
                className="size-5 accent-blue"
              />
              Show problems first
            </label>
          </div>

          <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
            <table className="w-full text-left">
              <thead className="border-b border-line bg-page">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Result
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Label image
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Brand on application
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Summary
                  </th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-muted">
                      No labels in this group yet.
                    </td>
                  </tr>
                )}
                {shown.map(({ it, i }) => (
                  <BatchRow
                    key={i}
                    item={it}
                    open={open === i}
                    onToggle={() => setOpen(open === i ? null : i)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function BatchRow({ item, open, onToggle }: { item: Item; open: boolean; onToggle: () => void }) {
  const summary =
    item.state === "done"
      ? item.result!.headline
      : item.state === "error" || item.state === "missing"
        ? item.error
        : item.state === "checking"
          ? "Reading the label…"
          : "Waiting";
  return (
    <>
      <tr className="border-t border-line-soft align-top">
        <td className="px-4 py-3">
          {item.result ? (
            <StatusMark status={item.result.verdict} size="sm" />
          ) : item.state === "missing" ? (
            <span className="font-semibold whitespace-nowrap text-fail">Missing image</span>
          ) : item.state === "error" ? (
            <span className="font-semibold whitespace-nowrap text-fail">Not checked</span>
          ) : (
            <span className="text-muted">{item.state === "checking" ? "Checking" : "Waiting"}</span>
          )}
        </td>
        <td className="px-4 py-3 break-all">{item.name}</td>
        <td className="px-4 py-3 font-serif">
          {item.application?.brandName || <span className="font-sans text-muted">No application row</span>}
        </td>
        <td className="px-4 py-3">
          {summary}
          {item.duplicateOf && <span className="block text-muted">Same image as {item.duplicateOf}.</span>}
        </td>
        <td className="px-4 py-3 text-right">
          {item.result && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={open}
              className="font-semibold whitespace-nowrap text-blue underline underline-offset-2"
            >
              {open ? "Hide details" : "Show details"}
            </button>
          )}
        </td>
      </tr>
      {open && item.result && item.file && (
        <tr>
          <td colSpan={5} className="bg-page px-4 py-5">
            <BatchDetail file={item.file} result={item.result} />
          </td>
        </tr>
      )}
    </>
  );
}

function BatchDetail({ file, result }: { file: File; result: VerificationResult }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
      <img
        src={objectUrl(file)}
        alt={`Label image ${file.name}`}
        className="w-full rounded-lg bg-white object-contain ring-1 ring-line"
      />
      <ResultView result={result} />
    </div>
  );
}
