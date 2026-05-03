"use client";

import { translations } from "@/app/lib/i18n";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onApply: () => void;
  lang?: "tr" | "en";
}

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, onApply, lang = "tr" }: DateRangePickerProps) {
  const t = translations[lang];
  return (
    <div className="bg-surface-container rounded-3xl p-6 flex items-end gap-3">
      <div className="flex-1">
        <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">{t.startDate}</label>
        <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)}
          className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
      </div>
      <div className="flex-1">
        <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">{t.endDate}</label>
        <input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)}
          className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
      </div>
      <button
        onClick={onApply}
        disabled={!!(startDate && endDate && startDate > endDate)}
        className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-5 py-2 rounded-xl text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
        {t.apply}
      </button>
    </div>
  );
}
