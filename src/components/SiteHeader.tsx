"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Check one label" },
  { href: "/batch", label: "Check a batch" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="bg-navy text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-2 pt-4">
        <Link href="/" className="pb-3 text-2xl font-bold tracking-tight">
          Label Check
        </Link>
        <nav aria-label="Main">
          <ul className="flex gap-1">
            {TABS.map((t) => {
              const active = path === t.href;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-t-md px-3 py-3 whitespace-nowrap sm:px-5 sm:text-lg font-semibold ${
                      active ? "bg-page text-navy" : "text-white hover:bg-white/10"
                    }`}
                  >
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
