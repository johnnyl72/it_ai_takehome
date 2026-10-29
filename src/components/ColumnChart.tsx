"use client";

import { useState } from "react";

const W = 680;
const H = 230;
const BAR = 22;
const GAP = 2;

export interface Series {
  key: string;
  label: string;
  color: string;
}

export interface Column {
  day: number;
  values: Record<string, number>;
  /** Extra lines for the tooltip, such as who finished them. */
  details?: { name: string; n: number }[];
}

const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const fullDay = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" });

/** A segment's path: square, or rounded at the top when it ends the column. */
function segment(x: number, y: number, h: number, round: boolean) {
  const r = round ? Math.min(4, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + BAR - r}Q${x + BAR},${y} ${x + BAR},${y + r}V${y + h}Z`;
}

const niceStep = (max: number) => [5, 10, 20, 50, 100, 200, 500, 1000].find((s) => max / s <= 5) ?? 2000;

/**
 * Columns per day, stacked when there's more than one series. The total is
 * labelled on the peak day and today; a tooltip and the table that goes with
 * each chart carry the rest.
 */
export function ColumnChart({
  columns,
  series,
  what,
}: {
  columns: Column[];
  series: Series[];
  what: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const stacked = series.length > 1;
  const pad = { top: 28, right: stacked ? 118 : 8, bottom: 32, left: 44 };
  const total = (c: Column) => series.reduce((sum, s) => sum + (c.values[s.key] ?? 0), 0);
  const max = Math.max(1, ...columns.map(total));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const slot = plotW / columns.length;
  const y = (v: number) => pad.top + plotH - (v / top) * plotH;
  const peak = columns.reduce((best, c, i) => (total(c) > total(columns[best]) ? i : best), 0);
  const labelled = new Set([peak, columns.length - 1]);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const last = columns.length - 1;
  const xOf = (i: number) => pad.left + i * slot + (slot - BAR) / 2;
  const shown = hover !== null ? columns[hover] : null;

  return (
    <figure className="relative">
      {stacked && (
        <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-hidden>
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${what} per day: ${columns
          .map(
            (c) =>
              `${fullDay.format(c.day)}, ${series.map((s) => `${c.values[s.key] ?? 0} ${s.label.toLowerCase()}`).join(", ")}`,
          )
          .join("; ")}.`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-line-soft)" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted text-[12px]">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {columns.map((c, i) => {
          const x = xOf(i);
          let base = 0;
          const visible = series.filter((s) => (c.values[s.key] ?? 0) > 0);
          return (
            <g
              key={c.day}
              tabIndex={0}
              aria-label={`${fullDay.format(c.day)}: ${series.map((s) => `${c.values[s.key] ?? 0} ${s.label.toLowerCase()}`).join(", ")}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            >
              {/* The hit area is the whole slot, far bigger than the bar. */}
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={plotH} fill="transparent" />
              {visible.map((s, k) => {
                const v = c.values[s.key];
                const yTop = y(base + v);
                // A surface-coloured gap separates stacked segments.
                const h = y(base) - yTop - (k > 0 ? GAP : 0);
                base += v;
                return (
                  <path
                    key={s.key}
                    d={segment(x, yTop, Math.max(0, h), k === visible.length - 1)}
                    fill={s.color}
                    opacity={hover === null || hover === i ? 1 : 0.55}
                  />
                );
              })}
              {labelled.has(i) && total(c) > 0 && (
                <text
                  x={x + BAR / 2}
                  y={y(total(c)) - 8}
                  textAnchor="middle"
                  className="fill-ink text-[13px] font-semibold"
                >
                  {total(c).toLocaleString()}
                </text>
              )}
              <text
                x={x + BAR / 2}
                y={H - 10}
                textAnchor="middle"
                className={`text-[12px] ${i === last ? "fill-ink font-semibold" : "fill-muted"}`}
              >
                {i === last ? "Today" : dayLabel.format(c.day)}
              </text>
            </g>
          );
        })}
        {/* Direct labels beside today's column, alongside the legend. */}
        {stacked &&
          (() => {
            let base = 0;
            return series.map((s) => {
              const v = columns[last]?.values[s.key] ?? 0;
              const mid = y(base + v / 2);
              base += v;
              return v > 0 ? (
                <text key={s.key} x={xOf(last) + BAR + 8} y={mid + 4} className="fill-muted text-[12px]">
                  {s.label}
                </text>
              ) : null;
            });
          })()}
        <line x1={pad.left} x2={W - pad.right} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
      </svg>
      {shown && hover !== null && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 w-56 -translate-x-1/2 rounded-md bg-white p-3 text-sm shadow-lg ring-1 ring-line"
          style={{ left: `${Math.min(80, Math.max(18, ((pad.left + (hover + 0.5) * slot) / W) * 100))}%` }}
        >
          <p className="font-semibold">{fullDay.format(shown.day)}</p>
          <ul className="mt-1">
            {series.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  {stacked && <span className="size-2.5 rounded-sm" style={{ background: s.color }} />}
                  {s.label}
                </span>
                <span className="tabular-nums">{(shown.values[s.key] ?? 0).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {shown.details && shown.details.length > 0 && (
            <ul className="mt-1 border-t border-line-soft pt-1 text-muted">
              {shown.details.map((p) => (
                <li key={p.name} className="flex justify-between gap-3">
                  <span>{p.name}</span>
                  <span className="tabular-nums">{p.n}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </figure>
  );
}
