"use client";

import MIcon from "@/app/components/shared/MIcon";
import { translations } from "@/app/lib/i18n";

interface KPISummaryProps {
  avgScore: number;
  totalCalls: number;
  highestScore: number;
  lang?: "tr" | "en";
  labels?: {
    avgScore?: string;
    performance?: string;
    calls?: string;
  };
}

export default function KPISummary({ avgScore, totalCalls, highestScore, lang = "tr", labels = {} }: KPISummaryProps) {
  const t = translations[lang];
  const { avgScore: avgLabel = t.avgScore, performance: perfLabel = t.overallPerformance, calls: callsLabel = t.totalCallsLabel } = labels;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[180px]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-slate-400 text-sm font-semibold tracking-wider">{avgLabel.toUpperCase()}</div>
            <MIcon name="insights" className="text-primary" />
          </div>
          <div className="font-headline text-6xl font-black text-white">{avgScore}<span className="text-2xl text-primary">%</span></div>
        </div>
        <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden mt-4">
          <div className="bg-primary h-full transition-all" style={{ width: `${Math.min(100, Math.max(0, avgScore))}%` }} />
        </div>
      </div>

      <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[180px]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-slate-400 text-sm font-semibold tracking-wider">{perfLabel.toUpperCase()}</div>
            <MIcon name="verified_user" className="text-primary" />
          </div>
          <div className="font-headline text-6xl font-black text-white">{(avgScore / 10).toFixed(1)}<span className="text-2xl text-primary">/10</span></div>
        </div>
      </div>

      <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[180px]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-slate-400 text-sm font-semibold tracking-wider">{callsLabel.toUpperCase()}</div>
            <MIcon name="call" className="text-primary" />
          </div>
          <div className="font-headline text-6xl font-black text-white">{totalCalls}</div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm mt-4">
          <MIcon name="emoji_events" className="text-amber-400 text-sm" />
          <span>{t.highestLabel(highestScore)}</span>
        </div>
      </div>
    </section>
  );
}
