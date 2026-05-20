"use client";

import { useState, useEffect } from "react";
import MIcon from "@/app/components/shared/MIcon";

type Range = "4w" | "3m" | "6m" | "all";
type View = "sections" | "criteria";

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

interface WeekCriteriaData {
  week: string;
  date: string;
  topCriteria: Array<{ id: string; label: string; count: number; avgScore: number }>;
}

interface TopCriterion {
  id: string;
  label: string;
  totalCount: number;
}

interface TrendData {
  weeks: TrendWeek[];
  trendIndicators: {
    periodDrop: DropIndicator | null;
    lastWeekDrop: DropIndicator | null;
  };
  hasEnoughData: boolean;
  weakCriteriaTrend: WeekCriteriaData[];
  topCriteriaOverall: TopCriterion[];
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

function heatColor(count: number): string {
  if (count >= 3) return "#7f1d1d";
  if (count === 2) return "#991b1b";
  return "#b91c1c";
}

function chipColor(count: number): { bg: string; border: string; text: string } {
  if (count >= 3) return { bg: "rgba(239,68,68,.2)", border: "rgba(239,68,68,.3)", text: "#f87171" };
  if (count === 2) return { bg: "rgba(251,146,60,.15)", border: "rgba(251,146,60,.3)", text: "#fb923c" };
  return { bg: "rgba(251,191,36,.1)", border: "rgba(251,191,36,.3)", text: "#fbbf24" };
}

export default function TrendChart({ agentId }: { agentId: string }) {
  const [range, setRange] = useState<Range>("4w");
  const [view, setView] = useState<View>("sections");
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

  const hasWeakData = (data?.weakCriteriaTrend?.length ?? 0) > 0;
  const hasGeliSimData = (data?.weakCriteriaTrend?.length ?? 0) >= 2;

  return (
    <div className="space-y-4">
      <div className="bg-surface-container rounded-3xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="font-headline text-lg font-bold flex items-center gap-2">
              <MIcon name="show_chart" className="text-primary" />
              Kategori Trendi
            </h3>
            <div className="flex gap-1 bg-surface-container-high rounded-lg p-0.5">
              <button
                onClick={() => setView("sections")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  view === "sections" ? "bg-primary text-on-primary" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Kategoriler
              </button>
              <button
                onClick={() => setView("criteria")}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  view === "criteria" ? "bg-primary text-on-primary" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                Kriterler
              </button>
            </div>
          </div>
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
        ) : view === "sections" ? (
          /* ── Kategoriler view ── */
          !data || !data.hasEnoughData ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm text-center px-4">
              Trend hesaplanabilmesi için seçili dönemde en az 2 haftalık veri gerekir.
            </div>
          ) : (
            <>
              <div className="bg-surface-container-high rounded-2xl p-4 mb-4">
                <svg
                  viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                  className="w-full"
                  style={{ height: SVG_H }}
                >
                  {[25, 50, 75, 100].map((v) => (
                    <g key={v}>
                      <line
                        x1={PAD_L} y1={chartY(v)} x2={SVG_W - PAD_R} y2={chartY(v)}
                        stroke="#ffffff08" strokeWidth="1"
                      />
                      <text x={PAD_L - 4} y={chartY(v) + 3} fill="#475569" fontSize="7" textAnchor="end">
                        {v}
                      </text>
                    </g>
                  ))}
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
                  {(["A", "B", "C"] as const).map((key, ki) => {
                    const color = ki === 0 ? "#4ade80" : ki === 1 ? "#facc15" : "#f87171";
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
                <div className="flex gap-5 mt-3 pt-3 border-t border-white/5">
                  {[
                    { color: "#4ade80", label: "A — Giriş" },
                    { color: "#facc15", label: "B — Çözüm" },
                    { color: "#f87171", label: "C — Kapanış" },
                  ].map((l) => (
                    <span key={l.label} className="text-[10px] flex items-center gap-1.5" style={{ color: l.color }}>
                      <span className="inline-block w-3 rounded" style={{ height: 2, backgroundColor: l.color }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>
              {(data.trendIndicators.periodDrop || data.trendIndicators.lastWeekDrop) && (
                <div className="grid grid-cols-2 gap-3">
                  {data.trendIndicators.periodDrop && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">Dönem Trendi</p>
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 text-xl leading-none">↘</span>
                        <div>
                          <p className="text-red-300 text-xs font-bold">
                            {data.trendIndicators.periodDrop.section} — {data.trendIndicators.periodDrop.label}
                          </p>
                          <p className="text-red-400 text-[10px]">
                            %{data.trendIndicators.periodDrop.from} → %{data.trendIndicators.periodDrop.to}{" "}
                            <span className="text-slate-500">({data.trendIndicators.periodDrop.delta})</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {data.trendIndicators.lastWeekDrop && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">Son Hafta Uyarısı</p>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xl leading-none">⚠</span>
                        <div>
                          <p className="text-amber-300 text-xs font-bold">
                            {data.trendIndicators.lastWeekDrop.section} — {data.trendIndicators.lastWeekDrop.label}
                          </p>
                          <p className="text-amber-400 text-[10px]">
                            %{data.trendIndicators.lastWeekDrop.from} → %{data.trendIndicators.lastWeekDrop.to}{" "}
                            <span className="text-slate-500">({data.trendIndicators.lastWeekDrop.delta})</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )
        ) : (
          /* ── Kriterler view ── */
          !hasWeakData ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm text-center px-4">
              Bu dönemde zayıf kriter verisi bulunmuyor.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* Left: Heatmap */}
              <div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-3">Isı Haritası</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left text-[9px] text-slate-500 font-normal pb-2 pr-3 min-w-[110px]">
                          Kriter
                        </th>
                        {data!.weeks.map((w) => (
                          <th key={w.week} className="text-[9px] text-slate-500 font-normal pb-2 px-1 text-center">
                            {w.week}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data!.topCriteriaOverall.map((criterion) => (
                        <tr key={criterion.id}>
                          <td
                            className="text-[10px] text-slate-300 py-1 pr-3 truncate max-w-[110px]"
                            title={criterion.label}
                          >
                            {criterion.label}
                          </td>
                          {data!.weakCriteriaTrend.map((week) => {
                            const found = week.topCriteria.find((c) => c.id === criterion.id);
                            const count = found?.count ?? 0;
                            return (
                              <td key={week.week} className="py-1 px-1 text-center">
                                <span
                                  className="inline-flex items-center justify-center w-5 h-5 rounded text-[8px] font-bold"
                                  style={{
                                    background: count === 0 ? "rgba(255,255,255,.04)" : heatColor(count),
                                    border: count === 0 ? "1px solid rgba(255,255,255,.06)" : "none",
                                    color: count === 0 ? "#475569" : "#fca5a5",
                                  }}
                                >
                                  {count}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[9px] text-slate-600 mt-2">Hücre = o haftaki fail sayısı</p>
              </div>

              {/* Right: Weekly chip list */}
              <div>
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-3">Haftalık Liste</p>
                <div className="space-y-3">
                  {data!.weakCriteriaTrend.map((week) => (
                    <div key={week.week} className="flex items-start gap-2">
                      <span className="text-[9px] text-slate-500 min-w-[36px] mt-0.5 font-mono">{week.week}</span>
                      <div className="flex flex-wrap gap-1.5">
                        {week.topCriteria.slice(0, 5).map((c) => {
                          const color = chipColor(c.count);
                          return (
                            <span
                              key={c.id}
                              className="text-[9px] font-semibold px-2 py-0.5 rounded"
                              style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
                            >
                              {c.label} ×{c.count}
                            </span>
                          );
                        })}
                        {week.topCriteria.length > 5 && (
                          <span className="text-[9px] text-slate-500">+{week.topCriteria.length - 5} daha</span>
                        )}
                        {week.topCriteria.length === 0 && (
                          <span className="text-[9px] text-slate-600">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* Gelişim Takibi — always below, visible when >= 2 weeks of criteria data */}
      {hasGeliSimData && (
        <div className="bg-surface-container rounded-3xl p-8">
          <h3 className="font-headline text-lg font-bold flex items-center gap-2 mb-6">
            <MIcon name="local_fire_department" className="text-orange-400" />
            Gelişim Takibi
          </h3>
          <div className="space-y-3">
            {data!.weakCriteriaTrend
              .slice()
              .reverse()
              .map((week) => (
                <div key={week.week} className="flex items-start gap-4 py-2 border-b border-white/5 last:border-0">
                  <span className="text-[11px] text-slate-500 min-w-[100px] mt-0.5 shrink-0">{week.date}</span>
                  <div className="flex flex-wrap gap-2">
                    {week.topCriteria.slice(0, 5).map((c) => {
                      const color = chipColor(c.count);
                      return (
                        <span
                          key={c.id}
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                          style={{ background: color.bg, border: `1px solid ${color.border}`, color: color.text }}
                        >
                          {c.label} ×{c.count}
                        </span>
                      );
                    })}
                    {week.topCriteria.length > 5 && (
                      <span className="text-[10px] text-slate-500 mt-1">
                        +{week.topCriteria.length - 5} daha
                      </span>
                    )}
                    {week.topCriteria.length === 0 && (
                      <span className="text-[11px] text-slate-600">Bu hafta fail edilen kriter yok</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
