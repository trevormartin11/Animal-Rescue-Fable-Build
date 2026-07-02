"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

interface MonthDatum {
  month: string;
  label: string;
  total: number;
  count: number;
}

/**
 * Single-series monthly giving bars.
 * Mark spec: thin bars, 4px rounded data-end, baseline-anchored, recessive grid,
 * per-bar hover tooltip, selective direct label (max month only).
 */
export function MonthlyGivingChart({ data }: { data: MonthDatum[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.total), 1);
  const maxIndex = data.findIndex((d) => d.total === max && max > 0);

  // Recessive gridlines at 0 / half / max, rounded to friendly numbers
  const gridTop = niceCeil(max);
  const gridLines = [gridTop, gridTop / 2];

  const H = 180;
  const scale = (v: number) => (v / gridTop) * H;

  return (
    <div className="relative">
      <div className="relative" style={{ height: H + 24 }}>
        {/* gridlines */}
        {gridLines.map((v) => (
          <div
            key={v}
            className="absolute inset-x-0 border-t border-line/70 flex items-start"
            style={{ bottom: 24 + scale(v) }}
          >
            <span className="text-[10px] text-muted -mt-4 pr-1 bg-transparent">
              {formatMoney(v)}
            </span>
          </div>
        ))}
        <div className="absolute inset-x-0 border-t border-line" style={{ bottom: 24 }} />

        {/* bars */}
        <div className="absolute inset-0 flex items-end justify-around gap-1 px-2">
          {data.map((d, i) => (
            <div
              key={d.month}
              className="relative flex flex-col items-center justify-end flex-1 h-full cursor-default"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* selective direct label: max month only (others via tooltip) */}
              {i === maxIndex && d.total > 0 && hover !== i && (
                <span className="absolute text-[11px] font-bold text-ink-soft" style={{ bottom: 24 + scale(d.total) + 4 }}>
                  {formatMoney(d.total)}
                </span>
              )}
              {/* tooltip */}
              {hover === i && (
                <div
                  className="absolute z-10 rounded-lg bg-ink text-cream text-xs font-semibold px-2.5 py-1.5 whitespace-nowrap shadow-card"
                  style={{ bottom: 24 + Math.max(scale(d.total), 8) + 8 }}
                >
                  {new Date(d.month + "-15").toLocaleDateString("en-US", { month: "long" })}:{" "}
                  {formatMoney(d.total)}
                  {d.count > 0 ? ` · ${d.count} ${d.count === 1 ? "case" : "cases"}` : ""}
                </div>
              )}
              <div
                className="w-full max-w-7 rounded-t transition-colors"
                style={{
                  height: Math.max(d.total > 0 ? Math.max(scale(d.total), 3) : 2, 2),
                  marginBottom: 24,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  background: d.total > 0 ? (hover === i ? "#a34c26" : "#c05f33") : "#e9dfd0",
                }}
              />
              <span className="absolute bottom-0 text-[11px] font-semibold text-muted">
                {d.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * mag) return m * mag;
  }
  return 10 * mag;
}
