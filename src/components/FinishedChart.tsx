"use client";

import { useState } from "react";

const W = 640;
const H = 220;
const PAD = { top: 28, right: 8, bottom: 32, left: 36 };
const BAR = 24;

export interface Day {
  day: number;
  total: number;
  /** One line per person for the tooltip, already in display order. */
  parts: { name: string; n: number }[];
}

const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const fullDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

/** Rounded top, square base: the path for one column. */
function column(x: number, y: number, h: number) {
  const r = Math.min(4, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + BAR - r}Q${x + BAR},${y} ${x + BAR},${y + r}V${y + h}Z`;
}

/**
 * Applications finished per day, for the whole team. One series, so no
 * legend; who did what is in the tooltip and the table below the chart.
 */
export function FinishedChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.total));
  const step = max <= 10 ? 5 : max <= 50 ? 10 : 20;
  const top = Math.ceil(max / step) * step;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / days.length;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const peak = days.reduce((best, d, i) => (d.total > days[best].total ? i : best), 0);
  const label = new Set([peak, days.length - 1]);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const shown = hover !== null ? days[hover] : null;

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Applications finished per day: ${days.map((d) => `${fullDay.format(d.day)}, ${d.total}`).join("; ")}.`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line-soft)" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[12px]">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD.left + i * slot + (slot - BAR) / 2;
          const h = y(0) - y(d.total);
          return (
            <g
              key={d.day}
              tabIndex={0}
              aria-label={`${fullDay.format(d.day)}: ${d.total} finished`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            >
              {/* The hit area is the whole slot, far bigger than the bar. */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {d.total > 0 && (
                <path
                  d={column(x, y(d.total), h)}
                  fill={hover === i ? "var(--color-blue-dark)" : "var(--color-blue)"}
                />
              )}
              {label.has(i) && d.total > 0 && (
                <text
                  x={x + BAR / 2}
                  y={y(d.total) - 8}
                  textAnchor="middle"
                  className="fill-ink text-[13px] font-semibold"
                >
                  {d.total}
                </text>
              )}
              <text
                x={x + BAR / 2}
                y={H - 10}
                textAnchor="middle"
                className={`text-[13px] ${i === days.length - 1 ? "fill-ink font-semibold" : "fill-muted"}`}
              >
                {i === days.length - 1 ? "Today" : dayLabel.format(d.day)}
              </text>
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
      </svg>
      {shown && hover !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 w-52 -translate-x-1/2 rounded-md bg-white p-3 text-sm shadow-lg ring-1 ring-line"
          style={{ left: `${Math.min(84, Math.max(16, ((PAD.left + (hover + 0.5) * slot) / W) * 100))}%` }}
        >
          <p className="font-semibold">{fullDay.format(shown.day)}</p>
          <p>{shown.total} finished</p>
          <ul className="mt-1 text-muted">
            {shown.parts.map((p) => (
              <li key={p.name} className="flex justify-between gap-3">
                <span>{p.name}</span>
                <span className="tabular-nums">{p.n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
