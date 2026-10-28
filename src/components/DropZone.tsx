"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { filesFromDrop, visibleFiles } from "@/lib/client/files";

/**
 * A big target that accepts a click or a drop. The visible button opens the
 * file picker, so it works without a mouse and without knowing drag-and-drop.
 */
export function DropZone({
  onFiles,
  multiple = false,
  folder = false,
  accept,
  buttonText,
  hint,
  invalid,
  describedBy,
  disabled,
  children,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  /** Also offer "Choose a folder", for importers who send a folder of labels. */
  folder?: boolean;
  accept: string;
  buttonText: string;
  hint: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const [over, setOver] = useState(false);

  const take = (files: File[]) => {
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    take(visibleFiles(e.target.files));
    e.target.value = "";
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) filesFromDrop(e.dataTransfer).then(take);
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        over ? "border-blue bg-blue-soft" : invalid ? "border-fail bg-white" : "border-line bg-white"
      }`}
    >
      {children}
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => input.current?.click()}
          aria-describedby={[hintId, describedBy].filter(Boolean).join(" ")}
          className="rounded-md border-2 border-blue bg-white px-5 py-3 text-lg font-semibold text-blue hover:bg-blue-soft disabled:opacity-50"
        >
          {buttonText}
        </button>
        {folder && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => folderInput.current?.click()}
            className="rounded-md border-2 border-blue bg-white px-5 py-3 text-lg font-semibold text-blue hover:bg-blue-soft disabled:opacity-50"
          >
            Choose a folder
          </button>
        )}
      </div>
      <p id={hintId} className="text-muted">
        {hint}
      </p>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onChange}
      />
      {folder && (
        <input
          // webkitdirectory isn't in React's types; every current browser supports it.
          ref={(el) => {
            folderInput.current = el;
            el?.setAttribute("webkitdirectory", "");
          }}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={onChange}
        />
      )}
    </div>
  );
}
