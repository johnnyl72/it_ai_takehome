"use client";

import Link from "next/link";
import { useDemo } from "@/lib/client/demo";
import { can } from "@/lib/demo/store";

/**
 * Applications normally arrive from COLA and are checked automatically;
 * these tools are for labels that aren't in COLA.
 */
export function OwnLabelsNav({ current }: { current: "check" | "batch" }) {
  const s = useDemo();
  const tabs = [
    { id: "check", href: "/check", label: "One label", show: can(s, s.currentUser, "check.single") },
    { id: "batch", href: "/batch", label: "A folder and a CSV", show: can(s, s.currentUser, "check.batch") },
  ].filter((t) => t.show);
  return (
    <div className="mb-8 space-y-3">
      <p className="max-w-3xl text-muted">
        Applications from COLA are checked automatically and land in the queue. Use these for labels that
        aren&apos;t in COLA, such as one sent by email or a folder an importer sent.
      </p>
      {tabs.length > 1 && (
        <nav aria-label="Your own labels" className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.href}
              aria-current={t.id === current ? "page" : undefined}
              className={`rounded-md px-4 py-2 font-semibold ring-2 ${
                t.id === current
                  ? "bg-navy text-white ring-navy"
                  : "bg-white text-blue ring-line hover:ring-blue"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
