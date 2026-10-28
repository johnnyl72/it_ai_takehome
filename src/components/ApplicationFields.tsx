"use client";

import type { Application, ApplicationField } from "@/lib/types";

const FIELDS: { key: ApplicationField; label: string; hint?: string; required?: boolean }[] = [
  { key: "brandName", label: "Brand name", required: true },
  { key: "classType", label: "Class / type", hint: "For example: Kentucky Straight Bourbon Whiskey" },
  { key: "alcoholContent", label: "Alcohol content", hint: "For example: 45% Alc./Vol. (90 Proof)" },
  { key: "netContents", label: "Net contents", hint: "For example: 750 mL" },
  { key: "bottler", label: "Bottler or producer name and address" },
  { key: "countryOfOrigin", label: "Country of origin", hint: "Imports only" },
];

export function ApplicationFields({
  value,
  onChange,
  errors,
  disabled,
}: {
  value: Application;
  onChange: (next: Application) => void;
  errors: Partial<Record<ApplicationField, string>>;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <legend className="sr-only">What the application says</legend>
      {FIELDS.map((f) => {
        const id = `app-${f.key}`;
        const error = errors[f.key];
        const describedBy = [f.hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
        return (
          <div key={f.key}>
            <label htmlFor={id} className="block text-lg font-semibold">
              {f.label}
              {!f.required && <span className="font-normal text-muted"> (optional)</span>}
            </label>
            {f.hint && (
              <p id={`${id}-hint`} className="text-muted">
                {f.hint}
              </p>
            )}
            {error && (
              <p id={`${id}-error`} className="font-semibold text-fail">
                {error}
              </p>
            )}
            <input
              id={id}
              name={f.key}
              value={value[f.key]}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
              aria-invalid={!!error}
              aria-describedby={describedBy || undefined}
              autoComplete="off"
              className={`mt-1 w-full rounded-md border-2 bg-white px-3 py-2.5 font-serif text-lg disabled:bg-page ${
                error ? "border-fail" : "border-line focus:border-blue"
              }`}
            />
          </div>
        );
      })}
    </fieldset>
  );
}
