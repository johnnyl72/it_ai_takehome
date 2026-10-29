"use client";

import type { Ref } from "react";
import type { Check, VerificationResult } from "@/lib/types";
import { StatusIcon, StatusMark } from "./StatusMark";

const BAND: Record<VerificationResult["verdict"], string> = {
  pass: "border-pass bg-pass-soft text-pass",
  review: "border-review bg-review-soft text-review",
  fail: "border-fail bg-fail-soft text-fail",
};

const SUBLINE: Record<VerificationResult["verdict"], string> = {
  pass: "The label matches what the application says.",
  review: "Nothing is clearly wrong, but some items need a human look.",
  fail: "The label and application disagree, or a required item is wrong.",
};

function Quote({ children, empty }: { children: string | null; empty: string }) {
  return children ? (
    <dd className="font-serif text-lg leading-snug break-words">{children}</dd>
  ) : (
    <dd className="text-muted italic">{empty}</dd>
  );
}

function FieldRow({ check }: { check: Check }) {
  return (
    <li className="grid gap-x-6 gap-y-2 border-t border-line-soft py-5 sm:grid-cols-[8.5rem_1fr]">
      <div>
        <StatusMark status={check.status} />
      </div>
      <div>
        <h3 className="text-lg font-semibold">{check.label}</h3>
        <p className="text-muted">{check.note}</p>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold text-muted">Application says</dt>
            <Quote empty="(blank)">{check.expected}</Quote>
          </div>
          <div>
            <dt className="text-sm font-semibold text-muted">Label says</dt>
            <Quote empty="Not found on the label">{check.found}</Quote>
          </div>
        </dl>
      </div>
    </li>
  );
}

/**
 * The warning wording as a proofreader would mark it: required words that are
 * missing are struck through, words that shouldn't be there are highlighted.
 */
function WarningRow({ check }: { check: Check }) {
  return (
    <li className="grid gap-x-6 gap-y-2 border-t border-line-soft py-5 sm:grid-cols-[8.5rem_1fr]">
      <div>
        <StatusMark status={check.status} />
      </div>
      <div>
        <h3 className="text-lg font-semibold">{check.label}</h3>
        {check.details ? (
          <ul className="mt-1 space-y-1">
            {check.details.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span
                  className={`mt-0.5 shrink-0 ${
                    d.status === "pass" ? "text-pass" : d.status === "review" ? "text-review" : "text-fail"
                  }`}
                >
                  <StatusIcon status={d.status} />
                  <span className="sr-only">{d.status === "pass" ? "OK:" : "Issue:"}</span>
                </span>
                <span>{d.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">{check.note}</p>
        )}

        {check.diff ? (
          <figure className="mt-4 rounded-md border border-line bg-white p-4">
            <figcaption className="mb-2 text-sm text-muted">
              Label wording compared with the required statement.{" "}
              <del className="decoration-fail decoration-2 text-fail">Struck through</del>: required, but
              missing or changed. <ins className="bg-review-soft no-underline px-1">Highlighted</ins>: on the
              label, but not in the required statement.
              {check.diff.some((d) => d.op === "misread") && (
                <>
                  {" "}
                  <span className="underline decoration-review decoration-dotted decoration-2 underline-offset-4">
                    Dotted
                  </span>
                  : probably misread by the reader, not changed on the label.
                </>
              )}
            </figcaption>
            <p className="font-serif text-lg leading-relaxed">
              {check.diff.map((d, i) =>
                d.op === "same" ? (
                  <span key={i}>{d.text} </span>
                ) : d.op === "misread" ? (
                  <span key={i}>
                    <span
                      title={`Required: ${d.expected}`}
                      className="underline decoration-review decoration-dotted decoration-2 underline-offset-4"
                    >
                      <span className="sr-only">[probably misread, required word is {d.expected}: </span>
                      {d.text}
                      <span className="sr-only">]</span>
                    </span>{" "}
                  </span>
                ) : d.op === "missing" ? (
                  <del key={i} className="text-fail decoration-fail decoration-2">
                    <span className="sr-only">[missing: </span>
                    {d.text}
                    <span className="sr-only">]</span>{" "}
                  </del>
                ) : (
                  <ins key={i} className="bg-review-soft no-underline px-0.5">
                    <span className="sr-only">[added: </span>
                    {d.text}
                    <span className="sr-only">]</span>{" "}
                  </ins>
                ),
              )}
            </p>
          </figure>
        ) : check.found ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-blue underline underline-offset-2">
              Show the warning as read from the label
            </summary>
            <p className="mt-2 font-serif text-lg leading-relaxed">{check.found}</p>
          </details>
        ) : null}
      </div>
    </li>
  );
}

export function ResultView({
  result,
  headingRef,
  showReadText = true,
}: {
  result: VerificationResult;
  /** Focused after a check so screen readers announce the verdict. */
  headingRef?: Ref<HTMLHeadingElement>;
  /** Every line the reader found; a role may be set not to see it. */
  showReadText?: boolean;
}) {
  const fields = result.checks.filter((c) => c.id !== "governmentWarning" && c.status !== "skipped");
  const skipped = result.checks.filter((c) => c.status === "skipped");
  const warning = result.checks.find((c) => c.id === "governmentWarning");

  return (
    <section aria-labelledby="result-heading" className="rounded-lg bg-white shadow-sm ring-1 ring-line-soft">
      <div className={`flex gap-4 rounded-t-lg border-l-8 p-5 ${BAND[result.verdict]}`}>
        <StatusIcon status={result.verdict} className="size-9 shrink-0" />
        <div>
          <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
            {result.headline}
          </h2>
          <p className="text-ink">{SUBLINE[result.verdict]}</p>
        </div>
      </div>

      {result.imageNote && (
        <p role="note" className="mx-5 mt-5 rounded-md bg-review-soft p-4 text-ink">
          <strong className="font-semibold">About the image:</strong> {result.imageNote}
        </p>
      )}

      <ol className="px-5">
        {fields.map((c) => (
          <FieldRow key={c.id} check={c} />
        ))}
        {warning && <WarningRow check={warning} />}
      </ol>

      <div className="space-y-1 border-t border-line-soft px-5 py-4 text-muted">
        {skipped.length > 0 && (
          <p>Blank on the application, so not checked: {skipped.map((c) => c.label).join(", ")}.</p>
        )}
        <p>
          Read on this computer by {result.engine} in {(result.timing.totalMs / 1000).toFixed(1)} seconds
          {result.reading.straightenedBy
            ? `, after straightening the photo by ${Math.abs(result.reading.straightenedBy).toFixed(0)}°`
            : ""}
          .
        </p>
        {showReadText && (
          <details>
            <summary className="cursor-pointer text-blue underline underline-offset-2">
              Show all text read from the label
            </summary>
            <p className="mt-2 text-sm">
              Average reading confidence {result.reading.meanConfidence}%. Lines in reading order:
            </p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-6 font-serif text-ink">
              {result.reading.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </details>
        )}
      </div>
    </section>
  );
}
