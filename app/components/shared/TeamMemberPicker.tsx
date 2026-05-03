"use client";

import { translations } from "@/app/lib/i18n";

interface Member {
  id: string;
  name: string;
  role: string;
}

interface TeamMemberPickerProps {
  members: Member[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  lang?: "tr" | "en";
}

export default function TeamMemberPicker({ members, selectedIds, onChange, lang = "tr" }: TeamMemberPickerProps) {
  const t = translations[lang];
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const allSelected = members.length > 0 && selectedIds.length === members.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : members.map(m => m.id));
  };

  return (
    <div className="bg-surface-container rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">{t.consultantsLabel}</h3>
        <button onClick={toggleAll} className="text-xs text-primary hover:underline">
          {allSelected ? t.deselectAll : t.selectAll}
        </button>
      </div>
      <div className="space-y-2">
        {members.map(m => (
          <label key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(m.id)}
              onChange={() => toggle(m.id)}
              className="w-4 h-4 accent-primary"
            />
            <div className="w-8 h-8 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary text-xs font-bold">
              {m.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-on-surface">{m.name}</span>
          </label>
        ))}
        {members.length === 0 && <p className="text-slate-500 text-sm text-center py-4">{t.noConsultantsInTeam}</p>}
      </div>
    </div>
  );
}
