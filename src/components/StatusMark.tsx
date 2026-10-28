import type { Status } from "@/lib/types";

export const STATUS_WORDS: Record<Status, string> = {
  pass: "Match",
  review: "Review",
  fail: "Problem",
  skipped: "Not checked",
};

const STYLES: Record<Status, string> = {
  pass: "bg-pass-soft text-pass",
  review: "bg-review-soft text-review",
  fail: "bg-fail-soft text-fail",
  skipped: "bg-line-soft text-muted",
};

export function StatusIcon({ status, className = "size-5" }: { status: Status; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (status) {
    case "pass":
      return (
        <svg {...common}>
          <path d="M4.5 12.5l5 5 10-11" />
        </svg>
      );
    case "review":
      return (
        <svg {...common}>
          <path d="M12 5v9" />
          <path d="M12 19.5v.01" />
        </svg>
      );
    case "fail":
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6 12h12" />
        </svg>
      );
  }
}

export function StatusMark({ status, size = "md" }: { status: Status; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${STYLES[status]} ${
        size === "sm" ? "px-2 py-0.5 text-sm" : "px-3 py-1"
      }`}
    >
      <StatusIcon status={status} className={size === "sm" ? "size-4" : "size-5"} />
      {STATUS_WORDS[status]}
    </span>
  );
}
