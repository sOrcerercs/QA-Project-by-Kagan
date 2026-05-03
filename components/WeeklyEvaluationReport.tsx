"use client";

import { useRef, useState, useEffect } from "react";
import { TrendingUp, AlertTriangle, Trophy, PhoneCall, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { translations } from "@/app/lib/i18n";

interface ReportData {
  consultantPerformance: {
    name: string; calls: number; healthScore: number;
    firstCallScore: number | null; firstCallCount: number;
    secondCallScore: number | null; secondCallCount: number;
  }[];
  dailyCallBreakdown: { date: string; firstCall: number; secondCall: number }[];
  callDurations: { name: string; calls: number; totalDuration: string; avgDuration: string }[];
  teamDistribution: { team: string; totalCalls: number; firstCall: number; secondCall: number }[];
  consultantCallDistribution: { name: string; totalCalls: number; firstCall: number; secondCall: number }[];
  unlistenedConsultants: { name: string; team: string }[];
  summary: {
    totalEvaluations: number;
    totalSecondCalls: number;
    avgScore: number;
    highPotential: number;
    atRisk: number;
  };
}

const getScoreColor = (score: number) =>
  score >= 80 ? "text-emerald-400" :
  score >= 70 ? "text-blue-400" :
  score >= 60 ? "text-amber-400" : "text-red-400";

export default function WeeklyEvaluationReport({ data, lang = "tr" }: { data?: ReportData | null; lang?: "tr" | "en" }) {
  const t = translations[lang];
  const reportRef = useRef<HTMLDivElement>(null);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const check = () => setIsLight(document.documentElement.classList.contains("light"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const chart = {
    grid: isLight ? "#e5e7eb" : "#27272a",
    axis: isLight ? "#9ca3af" : "#52525b",
    tooltipBg: isLight ? "#ffffff" : "#09090b",
    tooltipBorder: isLight ? "#e5e7eb" : "#27272a",
    tooltipText: isLight ? "#111827" : "#f4f4f5",
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: t.scoreBadge_excellent, cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" };
    if (score >= 70) return { label: t.scoreBadge_good, cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
    if (score >= 60) return { label: t.scoreBadge_medium, cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" };
    return { label: t.scoreBadge_poor, cls: "bg-red-500/10 text-red-400 border-red-500/20" };
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    const html2pdf = (await import("html2pdf.js" as any)).default;
    const opt = {
      margin: [10, 15, 10, 15],
      filename: "haftalik-degerlendirme-raporu.pdf",
      image: { type: "png", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };
    html2pdf().set(opt).from(reportRef.current).save();
  };

  if (!data) {
    return (
      <div className="py-24 text-center">
        <PhoneCall className="w-12 h-12 mx-auto mb-4 opacity-10" />
        <p className="text-on-surface-variant">{t.noEvaluationsLast7Days}</p>
      </div>
    );
  }

  const {
    consultantPerformance,
    dailyCallBreakdown,
    callDurations,
    teamDistribution,
    consultantCallDistribution,
    unlistenedConsultants,
    summary,
  } = data;

  const totalFirstCalls = dailyCallBreakdown.reduce((a, d) => a + d.firstCall, 0);
  const totalSecondCalls = dailyCallBreakdown.reduce((a, d) => a + d.secondCall, 0);
  const totalCalls = totalFirstCalls + totalSecondCalls;

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button
          onClick={handleExportPDF}
          className="flex items-center gap-2 bg-surface-container hover:bg-surface-container-high text-on-surface px-4 py-2 rounded-xl text-sm border border-outline-variant transition-all"
        >
          <Download className="h-4 w-4" /> {t.downloadPDF}
        </button>
      </div>

      <div ref={reportRef} className="space-y-8">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {[
            { label: t.totalEval, value: String(summary.totalEvaluations), sub: t.callsAnalyzed, icon: PhoneCall, color: "text-blue-400" },
            { label: "Second Call", value: String(summary.totalSecondCalls), sub: t.secondCallSub, icon: TrendingUp, color: "text-emerald-400" },
            { label: t.avgScoreLbl, value: `%${summary.avgScore}`, sub: t.avgPerformance, icon: Trophy, color: "text-amber-400" },
            { label: t.highPotential, value: String(summary.highPotential), sub: "Skor >= 70", icon: Trophy, color: "text-emerald-400" },
            { label: t.atRisk, value: String(summary.atRisk), sub: "Skor < 55", icon: AlertTriangle, color: "text-red-400" },
          ].map((card, i) => (
            <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 relative">
              <p className="text-[10px] text-on-surface-variant/60 font-bold uppercase tracking-widest mb-2">{card.label}</p>
              <p className={`text-3xl font-black ${card.color}`}>{card.value}</p>
              <p className={`text-[10px] mt-1 ${card.color} opacity-60`}>{card.sub}</p>
              <card.icon className={`absolute top-4 right-4 h-5 w-5 ${card.color} opacity-20`} />
            </div>
          ))}
        </div>

        {/* Daily Call Chart */}
        {dailyCallBreakdown.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-on-surface mb-1">{t.dailyCallDist}</h2>
            <p className="text-xs text-on-surface-variant mb-4">{t.selectedRange}</p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyCallBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="date" stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={chart.axis} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: "8px", color: chart.tooltipText }}
                      itemStyle={{ fontSize: "12px", color: chart.tooltipText }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "16px" }} />
                    <Bar dataKey="secondCall" name="Second Call" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="firstCall" name="First Call" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-outline-variant text-center">
                <div>
                  <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">Second Call</p>
                  <p className="text-2xl font-black text-blue-400">{totalSecondCalls}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">First Call</p>
                  <p className="text-2xl font-black text-emerald-400">{totalFirstCalls}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">{t.total.toUpperCase()}</p>
                  <p className="text-2xl font-black text-on-surface">{totalCalls}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Consultant Performance Scores */}
        {consultantPerformance.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-on-surface mb-1">{t.consultantPerfScores}</h2>
            <p className="text-xs text-on-surface-variant mb-4">{t.healthScoreAndCalls}</p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-outline-variant text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-3">{t.consultant}</th>
                    <th className="px-6 py-3 text-right">{t.firstCallCol}</th>
                    <th className="px-6 py-3 text-right">{t.secondCallCol}</th>
                    <th className="px-6 py-3 text-right">{t.statusCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {[...consultantPerformance].sort((a, b) => b.healthScore - a.healthScore).map((c, i) => {
                    const badge = getScoreBadge(c.healthScore);
                    return (
                      <tr key={i} className="hover:bg-surface-container transition-colors">
                        <td className="px-6 py-3 font-semibold text-on-surface">{c.name}</td>
                        <td className="px-6 py-3 text-right">
                          {c.firstCallScore !== null ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`font-black text-lg ${getScoreColor(c.firstCallScore)}`}>%{c.firstCallScore}</span>
                              <span className="text-[10px] text-on-surface-variant/60">{c.firstCallCount} {t.callsUnit}</span>
                            </div>
                          ) : <span className="text-on-surface-variant/30">—</span>}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {c.secondCallScore !== null ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`font-black text-lg ${getScoreColor(c.secondCallScore)}`}>%{c.secondCallScore}</span>
                              <span className="text-[10px] text-on-surface-variant/60">{c.secondCallCount} {t.callsUnit}</span>
                            </div>
                          ) : <span className="text-on-surface-variant/30">—</span>}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${badge.cls}`}>{badge.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Call Durations */}
        {callDurations.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-on-surface mb-1">{t.consultantCallDurationsTitle}</h2>
            <p className="text-xs text-on-surface-variant mb-4">{t.totalAndAvgDurations}</p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-outline-variant text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-3">{t.consultant}</th>
                    <th className="px-6 py-3 text-right">{t.callsCol}</th>
                    <th className="px-6 py-3 text-right">{t.totalDurationCol}</th>
                    <th className="px-6 py-3 text-right">{t.avgDurationCol}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {[...callDurations].sort((a, b) => b.calls - a.calls).map((c, i) => (
                    <tr key={i} className="hover:bg-surface-container transition-colors">
                      <td className="px-6 py-3 font-semibold text-on-surface">{c.name}</td>
                      <td className="px-6 py-3 text-right text-on-surface-variant">{c.calls}</td>
                      <td className="px-6 py-3 text-right text-on-surface-variant">{c.totalDuration}</td>
                      <td className="px-6 py-3 text-right font-bold text-on-surface">{c.avgDuration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Team Distribution */}
        {teamDistribution.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-on-surface mb-1">{t.teamCallDist}</h2>
            <p className="text-xs text-on-surface-variant mb-4">First Call &amp; Second Call</p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-outline-variant text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-3">{t.teamCol}</th>
                    <th className="px-6 py-3 text-right">{t.total}</th>
                    <th className="px-6 py-3 text-right">First Call</th>
                    <th className="px-6 py-3 text-right">Second Call</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {teamDistribution.map((row, i) => (
                    <tr key={i} className="hover:bg-surface-container transition-colors">
                      <td className="px-6 py-3 font-semibold text-on-surface">{row.team}</td>
                      <td className="px-6 py-3 text-right font-black text-on-surface">{row.totalCalls}</td>
                      <td className="px-6 py-3 text-right text-on-surface-variant">{row.firstCall}</td>
                      <td className="px-6 py-3 text-right text-blue-400 font-bold">{row.secondCall}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-container">
                    <td className="px-6 py-3 font-black text-on-surface">{t.total.toUpperCase()}</td>
                    <td className="px-6 py-3 text-right font-black text-on-surface">{teamDistribution.reduce((a, r) => a + r.totalCalls, 0)}</td>
                    <td className="px-6 py-3 text-right font-black text-on-surface">{teamDistribution.reduce((a, r) => a + r.firstCall, 0)}</td>
                    <td className="px-6 py-3 text-right font-black text-blue-400">{teamDistribution.reduce((a, r) => a + r.secondCall, 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Consultant Call Distribution */}
        {consultantCallDistribution.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-on-surface mb-1">{t.consultantCallDist}</h2>
            <p className="text-xs text-on-surface-variant mb-4">First Call &amp; Second Call</p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-outline-variant text-[10px] text-on-surface-variant/60 uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-3">{t.consultant}</th>
                    <th className="px-6 py-3 text-right">{t.total}</th>
                    <th className="px-6 py-3 text-right">First Call</th>
                    <th className="px-6 py-3 text-right">Second Call</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {[...consultantCallDistribution].sort((a, b) => b.totalCalls - a.totalCalls).map((c, i) => (
                    <tr key={i} className="hover:bg-surface-container transition-colors">
                      <td className="px-6 py-3 font-semibold text-on-surface">{c.name}</td>
                      <td className="px-6 py-3 text-right font-black text-on-surface">{c.totalCalls}</td>
                      <td className="px-6 py-3 text-right text-on-surface-variant">{c.firstCall}</td>
                      <td className="px-6 py-3 text-right text-blue-400 font-bold">{c.secondCall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Unlistened Consultants */}
        {unlistenedConsultants.length > 0 && (
          <div>
            <h2 className="text-lg font-black text-on-surface mb-1">{t.unlistenedTitle}</h2>
            <p className="text-xs text-on-surface-variant mb-4">{t.unlistenedSub}</p>
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {unlistenedConsultants.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
                      <span className="text-sm font-medium text-on-surface">{c.name}</span>
                    </div>
                    <span className="text-[10px] text-on-surface-variant">{c.team}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-outline-variant">
                <p className="text-xs text-on-surface-variant">{t.unlistenedCount(unlistenedConsultants.length)}</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
