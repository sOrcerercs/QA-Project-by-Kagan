"use client";

import { useState, useEffect } from "react";
import MIcon from "@/app/components/shared/MIcon";

type Range = "4w" | "3m" | "6m" | "all";

interface TrendWeek {
  week: string;
  date: string;
  A: number;
  B: number;
  C: number;
  callCount: number;
}

interface DropIndicator {
  section: "A" | "B" | "C";
  label: string;
  from: number;
  to: number;
  delta: number;
}

interface TrendData {
  weeks: TrendWeek[];
  trendIndicators: {
    periodDrop: DropIndicator | null;
    lastWeekDrop: DropIndicator | null;
  };
  hasEnoughData: boolean;
}

const RANGES: { label: string; value: Range }[] = [
  { label: "4H", value: "4w" },
  { label: "3A", value: "3m" },
  { label: "6A", value: "6m" },
  { label: "Tümü", value: "all" },
];

const SVG_W = 440;
const SVG_H = 130;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 12;
const PAD_B = 20;

function chartX(idx: number, total: number): number {
  if (total === 1) return PAD_L + (SVG_W - PAD_L - PAD_R) / 2;
  return PAD_L + (idx / (total - 1)) * (SVG_W - PAD_L - PAD_R);
}

function chartY(val: number): number {
  return PAD_T + (1 - val / 100) * (SVG_H - PAD_T - PAD_B);
}

function polylinePoints(weeks: TrendWeek[], key: "A" | "B" | "C"): string {
  return weeks.map((w, i) => `${chartX(i, weeks.length)},${chartY(w[key])}`).join(" ");
}

export default function TrendChart({ agentId }: { agentId: string }) {
  const [range, setRange] = useState<Range>("4w");
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scores/trend?agentId=${agentId}&range=${range}`)
      .then((r) => r.json())
      .then((d: TrendData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [agentId, range]);

  return (
    <div className="bg-surface-container rounded-3xl p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline text-lg font-bold flex items-center gap-2">
          <MIcon name="show_chart" className="text-primary" />
          Kategori Trendi
        </h3>
        <div className="flex gap-1 bg-surface-container-high rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === r.value
                  ? "bg-primary text-on-primary"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !data || !data.hasEnoughData ? (
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm text-center px-4">
          Trend hesaplanabilmesi için seçili dönemde en az 2 haftalık veri gerekir.
        </div>
      ) : (
        <>
          {/* SVG Chart */}
          <div className="bg-surface-container-high rounded-2xl p-4 mb-4">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full"
              style={{ height: SVG_H }}
            >
              {/* Grid lines */}
              {[25, 50, 75, 100].map((v) => (
                <g key={v}>
                  <line
                    x1={PAD_L}
                    y1={chartY(v)}
                    x2={SVG_W - PAD_R}
                    y2={chartY(v)}
                    stroke="#ffffff08"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD_L - 4}
                    y={chartY(v) + 3}
                    fill="#475569"
                    fontSize="7"
                    textAnchor="end"
                  >
                    {v}
                  </text>
                </g>
              ))}
              {/* X labels */}
              {data.weeks.map((w, i) => (
                <text
                  key={w.week}
                  x={chartX(i, data.weeks.length)}
                  y={SVG_H - 2}
                  fill="#475569"
                  fontSize="7"
                  textAnchor="middle"
                >
                  {w.week}
                </text>
              ))}
              {/* Lines + dots */}
              {(["A", "B", "C"] as const).map((key, ki) => {
                const color =
                  ki === 0 ? "#4ade80" : ki === 1 ? "#facc15" : "#f87171";
                return (
                  <g key={key}>
                    <polyline
                      points={polylinePoints(data.weeks, key)}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    {data.weeks.map((w, i) => (
                      <circle
                        key={i}
                        cx={chartX(i, data.weeks.length)}
                        cy={chartY(w[key])}
                        r="3"
                        fill={color}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
            {/* Legend */}
            <div className="flex gap-5 mt-3 pt-3 border-t border-white/5">
              {[
                { color: "#4ade80", label: "A — Giriş" },
                { color: "#facc15", label: "B — Çözüm" },
                { color: "#f87171", label: "C — Kapanış" },
              ].map((l) => (
                <span
                  key={l.label}
                  className="text-[10px] flex items-center gap-1.5"
                  style={{ color: l.color }}
                >
                  <span
                    className="inline-block w-3 rounded"
                    style={{ height: 2, backgroundColor: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* Trend Indicators */}
          {(data.trendIndicators.periodDrop ||
            data.trendIndicators.lastWeekDrop) && (
            <div className="grid grid-cols-2 gap-3">
              {data.trendIndicators.periodDrop && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                    Dönem Trendi
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-xl leading-none">↘</span>
                    <div>
                      <p className="text-red-300 text-xs font-bold">
                        {data.trendIndicators.periodDrop.section} —{" "}
                        {data.trendIndicators.periodDrop.label}
                      </p>
                      <p className="text-red-400 text-[10px]">
                        %{data.trendIndicators.periodDrop.from} → %
                        {data.trendIndicators.periodDrop.to}{" "}
                        <span className="text-slate-500">
                          ({data.trendIndicators.periodDrop.delta})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {data.trendIndicators.lastWeekDrop && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                    Son Hafta Uyarısı
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-xl leading-none">⚠</span>
                    <div>
                      <p className="text-amber-300 text-xs font-bold">
                        {data.trendIndicators.lastWeekDrop.section} —{" "}
                        {data.trendIndicators.lastWeekDrop.label}
                      </p>
                      <p className="text-amber-400 text-[10px]">
                        %{data.trendIndicators.lastWeekDrop.from} → %
                        {data.trendIndicators.lastWeekDrop.to}{" "}
                        <span className="text-slate-500">
                          ({data.trendIndicators.lastWeekDrop.delta})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
