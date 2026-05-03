"use client";

import Link from "next/link";
import { motion } from "motion/react";
import MIcon from "@/app/components/shared/MIcon";
import { translations } from "@/app/lib/i18n";

const scoreColor = (s: number) =>
  s >= 85 ? "text-emerald-400" : s >= 70 ? "text-primary" : s >= 55 ? "text-amber-400" : "text-error";

const scoreBg = (s: number) =>
  s >= 85 ? "bg-emerald-500" : s >= 70 ? "bg-primary" : s >= 55 ? "bg-amber-500" : "bg-red-500";

interface ScoreData {
  agent: { id: string; name: string; role: string; team: string };
  rank: number;
  totalAgents: number;
  stats: { totalCalls: number; avgScore: number; highestScore: number };
  weeklyProgress: { week: string; score: number; calls: number }[];
  recentCalls: { id: string; date: string; customer: string; score: number; callType: string; duration: string }[];
  isDemo?: boolean;
}

export default function ScoreView({ data, lang = "tr" }: { data: ScoreData; lang?: "tr" | "en" }) {
  const t = translations[lang];
  const { agent, rank, totalAgents, stats, weeklyProgress, recentCalls, isDemo } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-container rounded-3xl p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xl font-black">
            {agent.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{agent.name}</h2>
              {isDemo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>}
            </div>
            <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-primary/20 bg-primary/10 text-primary">{agent.team}</span>
              <span className="flex items-center gap-1"><MIcon name="emoji_events" className="text-amber-400 text-sm" /> #{rank} / {totalAgents}</span>
            </p>
          </div>
        </div>
        <div className={`font-headline text-6xl font-black ${scoreColor(stats.avgScore)}`}>%{stats.avgScore}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: t.totalCallsLabel, value: stats.totalCalls, color: "text-primary" },
          { label: t.avgScore, value: `%${stats.avgScore}`, color: "text-emerald-400" },
          { label: t.highest, value: `%${stats.highestScore}`, color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="bg-surface-container rounded-3xl p-6">
            <p className="text-slate-400 text-sm font-semibold tracking-wider mb-2">{s.label.toUpperCase()}</p>
            <p className={`font-headline text-4xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Weekly Progress */}
      <div className="bg-surface-container rounded-3xl p-8">
        <h3 className="font-headline text-lg font-bold mb-6 flex items-center gap-2">
          <MIcon name="trending_up" className="text-emerald-400" /> {t.weeklyProgressTitle}
        </h3>
        <div className="space-y-4">
          {weeklyProgress.map((week, idx) => {
            const prev = idx > 0 ? weeklyProgress[idx - 1].score : week.score;
            const change = week.score - prev;
            return (
              <div key={week.week} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MIcon name="calendar_today" className="text-slate-500 text-sm" />
                  <span className="text-sm text-slate-400">{week.week}</span>
                  <span className="text-[10px] text-slate-600">({week.calls} {t.callsUnit})</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-surface-container-lowest rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${scoreBg(week.score)}`} style={{ width: `${Math.min(100, Math.max(0, week.score))}%` }} />
                  </div>
                  <span className={`font-bold text-sm ${scoreColor(week.score)}`}>%{week.score}</span>
                  {idx > 0 && change !== 0 && (
                    <span className={`text-xs flex items-center ${change > 0 ? "text-emerald-400" : "text-error"}`}>
                      {change > 0 ? "+" : ""}{change}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Calls */}
      <div className="bg-surface-container rounded-3xl p-6 space-y-2">
        <h3 className="font-headline text-lg font-bold px-4 py-2 flex items-center gap-2">
          <MIcon name="call" className="text-primary" /> {t.recentCallsTitle}
        </h3>
        {recentCalls.map((call, i) => (
          <motion.div key={call.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-high transition-colors">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">{call.date}</span>
              <span className="text-sm font-medium">{call.customer}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-bold ${scoreColor(call.score)}`}>%{call.score}</span>
              {!call.id.startsWith("demo-") && (
                <Link href={`/evaluation/${call.id}`}>
                  <span className="text-xs text-slate-500 hover:text-primary transition-colors">{t.detailLink}</span>
                </Link>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
