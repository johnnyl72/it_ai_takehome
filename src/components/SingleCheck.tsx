"use client";

import { useEffect, useRef, useState } from "react";
import { checkLabel, CheckError } from "@/lib/client/api";
import { ImageError, isImageFile, preflightImage } from "@/lib/client/image";
import { objectUrl, releaseObjectUrl } from "@/lib/client/objectUrl";
import { SAMPLES, sampleImageUrl, type Sample } from "@/lib/samples";
import {
  EMPTY_APPLICATION,
  type Application,
  type ApplicationField,
  type VerificationResult,
} from "@/lib/types";
import { ApplicationFields } from "./ApplicationFields";
import { DropZone } from "./DropZone";
import { ResultView } from "./ResultView";
import { StatusMark } from "./StatusMark";

type Phase = "edit" | "checking" | "done";

/** After this long, say it's slow rather than leave the agent guessing. */
const SLOW_MS = 8000;

export function SingleCheck() {
  const [file, setFileState] = useState<File | null>(null);
  const [application, setApplication] = useState<Application>(EMPTY_APPLICATION);
  const [phase, setPhase] = useState<Phase>("edit");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ApplicationField, string>>>({});
  const [imageError, setImageError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  const preview = file ? objectUrl(file) : null;

  function setFile(next: File | null) {
    if (file && file !== next) releaseObjectUrl(file);
    setFileState(next);
  }

  useEffect(() => {
    if (phase !== "checking") return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "done") resultHeading.current?.focus();
  }, [phase]);

  async function chooseFile(files: File[]) {
    const f = files[0];
    if (!isImageFile(f)) {
      setImageError(`"${f.name}" isn't an image. Choose a JPG, PNG or WebP file.`);
      return;
    }
    // Say now if it can't be read, not after the agent has typed the whole application.
    try {
      await preflightImage(f);
    } catch (e) {
      setImageError(e instanceof ImageError ? e.message : `"${f.name}" couldn't be opened.`);
      return;
    }
    setImageError(null);
    setError(null);
    setFile(f);
  }

  async function loadSample(s: Sample) {
    setError(null);
    setImageError(null);
    setFieldErrors({});
    setResult(null);
    setPhase("edit");
    try {
      const blob = await (await fetch(sampleImageUrl(s))).blob();
      setFile(new File([blob], `${s.id}.jpg`, { type: "image/jpeg" }));
      setApplication(s.application);
    } catch {
      setError("The example couldn't be loaded. Check your connection.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Partial<Record<ApplicationField, string>> = {};
    if (!application.brandName.trim()) errs.brandName = "Enter the brand name from the application.";
    setFieldErrors(errs);
    setImageError(file ? null : "Choose the label image first.");
    if (!file) {
      document.getElementById("label-image")?.scrollIntoView({ block: "center" });
      return;
    }
    if (errs.brandName) {
      document.getElementById("app-brandName")?.focus();
      return;
    }

    setError(null);
    setElapsed(0);
    setPhase("checking");
    abort.current = new AbortController();
    try {
      setResult(await checkLabel(file, application, abort.current.signal));
      setPhase("done");
    } catch (err) {
      if (abort.current.signal.aborted) return setPhase("edit");
      setError(err instanceof CheckError ? err.message : "Something went wrong. Try again.");
      setPhase("edit");
      requestAnimationFrame(() => errorBox.current?.focus());
    }
  }

  function startOver() {
    setFile(null);
    setApplication(EMPTY_APPLICATION);
    setResult(null);
    setError(null);
    setFieldErrors({});
    setPhase("edit");
    window.scrollTo({ top: 0 });
  }

  const imagePanel = (
    <div id="label-image" className="space-y-3">
      <h2 className="text-xl font-bold">Label image</h2>
      {preview && phase === "done" ? (
        <a href={preview} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob URL */}
          <img
            src={preview}
            alt="The label image that was checked"
            className="max-h-[75vh] w-full rounded-lg bg-white object-contain ring-1 ring-line"
          />
          <span className="mt-2 inline-block text-blue underline underline-offset-2">
            Open full size in a new tab
          </span>
        </a>
      ) : (
        <DropZone
          onFiles={chooseFile}
          accept="image/*"
          buttonText={file ? "Choose a different image" : "Choose label image"}
          hint={file ? file.name : "or drag it here. JPG, PNG or WebP."}
          invalid={!!imageError}
          describedBy={imageError ? "image-error" : undefined}
        >
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob URL
            <img
              src={preview}
              alt="Preview of the chosen label"
              className="max-h-80 rounded object-contain"
            />
          )}
        </DropZone>
      )}
      {imageError && (
        <p id="image-error" className="font-semibold text-fail">
          {imageError}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold text-navy sm:text-4xl">Check a label against its application</h1>
        <p className="mt-2 text-lg">
          Add the label image and type in what the application says. The tool reads the label, compares each
          item, and checks the government warning word for word.
        </p>
      </div>

      {error && (
        <div
          ref={errorBox}
          tabIndex={-1}
          role="alert"
          className="rounded-md border-l-8 border-fail bg-fail-soft p-4 text-lg outline-none"
        >
          <strong className="font-semibold">The label wasn&apos;t checked.</strong> {error}
        </div>
      )}

      {phase === "done" && result ? (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-6">{imagePanel}</div>
          <div className="space-y-4">
            <ResultView result={result} headingRef={resultHeading} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startOver}
                className="rounded-md bg-blue px-6 py-3 text-lg font-semibold text-white hover:bg-blue-dark"
              >
                Check another label
              </button>
              <button
                type="button"
                onClick={() => setPhase("edit")}
                className="rounded-md border-2 border-blue bg-white px-6 py-3 text-lg font-semibold text-blue hover:bg-blue-soft"
              >
                Change details and check again
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid items-start gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            {imagePanel}
            <Examples onPick={loadSample} disabled={phase === "checking"} />
          </div>
          <div className="space-y-5 rounded-lg bg-white p-5 shadow-sm ring-1 ring-line-soft sm:p-6">
            <div>
              <h2 className="text-xl font-bold">What the application says</h2>
              <p className="text-muted">
                Leave a field blank to skip it. The government warning is always checked.
              </p>
            </div>
            <ApplicationFields
              value={application}
              onChange={setApplication}
              errors={fieldErrors}
              disabled={phase === "checking"}
            />
            <button
              type="submit"
              disabled={phase === "checking"}
              aria-busy={phase === "checking"}
              className="w-full rounded-md bg-blue px-6 py-4 text-xl font-bold text-white hover:bg-blue-dark disabled:cursor-wait disabled:opacity-80"
            >
              {phase === "checking" ? `Reading the label… ${Math.floor(elapsed / 1000)} s` : "Check label"}
            </button>
            <p aria-live="polite" className="min-h-6 text-muted">
              {phase === "checking" && elapsed > SLOW_MS && (
                <>
                  This is taking longer than usual.{" "}
                  <button
                    type="button"
                    onClick={() => abort.current?.abort()}
                    className="text-blue underline"
                  >
                    Cancel
                  </button>
                </>
              )}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

function Examples({ onPick, disabled }: { onPick: (s: Sample) => void; disabled: boolean }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">No label handy? Try an example</h2>
      <p className="text-muted">Fills in the image and the application details.</p>
      <ul className="mt-2 divide-y divide-line-soft rounded-lg bg-white ring-1 ring-line-soft">
        {SAMPLES.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-blue-soft disabled:opacity-60"
            >
              <span>
                <span className="block font-semibold text-blue underline underline-offset-2">{s.title}</span>
                <span className="block text-muted">{s.shows}</span>
              </span>
              <span className="shrink-0" aria-label={`Expected result: ${s.expected}`}>
                <StatusMark status={s.expected} size="sm" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
