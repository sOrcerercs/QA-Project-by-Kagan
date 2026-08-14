"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ConsultantMultiSelect from "@/app/components/shared/ConsultantMultiSelect";
import { ALL_MONTHS } from "@/app/lib/okr";
import type { DuplicateTier } from "@/app/lib/duplicateEvaluations";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

interface DupRow {
  id: string;
  callDate: string;
  customerName: string;
  agentName: string;
  callDuration: string;
  score: number;
  callType: string;
  source: string;
  coachingDone: boolean;
  agentRead: boolean;
}

interface DupGroup {
  tier: DuplicateTier;
  minutesApart: number;
  customerUnknown: boolean;
  rows: DupRow[];
}

interface DupData {
  month: string;
  windowMinutes: number;
  availableMonths: string[];
  agents: { id: string; name: string }[];
  totals: { groups: number; exact: number; likely: number; extraRows: number };
  groups: DupGroup[];
}

const T = {
  tr: {
    title: "Mükerrer Değerlendirmeler",
    desc: (w: number) =>
      `Aynı danışman ve aynı müşteri adına ait, birbirinden en fazla ${w} dakika uzaklıktaki çağrılar. Aynı görüşme Fireflies'ta iki kez bulunduğunda oluşur (biri canlı toplantı kaydı, biri sonradan yüklenen ses dosyası) — kayıtların transcript'i ve Fireflies id'si farklı olduğu için otomatik engellenemiyor.`,
    readOnly: "Bu ekran salt okunur — hiçbir kayıt silinmez veya birleştirilmez.",
    allMonths: "Tüm zamanlar",
    groups: "grup", exact: "kesin", likely: "çok olası", extra: "fazla kayıt",
    tierExact: "KESİN", tierLikely: "ÇOK OLASI",
    exactHint: "çağrı saatleri birebir aynı",
    likelyHint: (m: number) => `${m} dakika arayla`,
    unknownCustomer: "müşteri adı çözülemedi — eşleşme daha az kesin",
    open: "Çağrıyı aç",
    coaching: "koçluk yapılmış", read: "danışman okudu",
    empty: "Bu filtrede mükerrer kayıt bulunmadı.",
    loading: "Taranıyor...",
    firstCall: "1. Çağrı", secondCall: "2. Çağrı",
    diff: "farklı",
    loadFailed: "Yüklenemedi.",
  },
  en: {
    title: "Duplicate Evaluations",
    desc: (w: number) =>
      `Calls for the same consultant and customer name within ${w} minutes of each other. Happens when the same meeting exists twice in Fireflies (one live recording, one uploaded audio file) — the records have different transcripts and Fireflies ids, so they cannot be blocked automatically.`,
    readOnly: "This screen is read-only — nothing is deleted or merged.",
    allMonths: "All time",
    groups: "groups", exact: "certain", likely: "likely", extra: "extra rows",
    tierExact: "CERTAIN", tierLikely: "LIKELY",
    exactHint: "identical call times",
    likelyHint: (m: number) => `${m} minutes apart`,
    unknownCustomer: "customer name unresolved — match less certain",
    open: "Open call",
    coaching: "coached", read: "read by consultant",
    empty: "No duplicates for this filter.",
    loading: "Scanning...",
    firstCall: "First Call", secondCall: "Second Call",
    diff: "differs",
    loadFailed: "Failed to load.",
  },
};

function monthLabel(month: string, lang: "tr" | "en"): string {
  if (month === ALL_MONTHS) return T[lang].allMonths;
  const [y, m] = month.split("-").map(Number);
  const names = lang === "tr"
    ? ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[m - 1]} ${y}`;
}

const stamp = (iso: string, lang: "tr" | "en") =>
  new Date(iso).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });

export default function DuplicateEvaluationsView({ lang = "tr" }: { lang?: "tr" | "en" }) {
  const t = T[lang];
  const [month, setMonth] = useState<string>(ALL_MONTHS);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [data, setData] = useState<DupData | null>(null);
  const [loading, setLoading] = useState(true);
  // null = hata yok. Boş string = mesajsız hata; metni render anında
  // yerelleştiriyoruz, böylece load'un lang'a bağımlı olması gerekmiyor.
  const [error, setError] = useState<string | null>(null);

  // Yarış koruması: yalnızca en son isteğin yanıtı state'e yazılır.
  const reqIdRef = useRef(0);

  const load = useCallback(async (m: string, ids: string[]) => {
    const reqId = ++reqIdRef.current;
    const params = new URLSearchParams({ month: m });
    if (ids.length > 0) params.set("agentIds", ids.join(","));
    try {
      const res = await fetch(`/api/admin/duplicates?${params.toString()}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (reqId !== reqIdRef.current) return;
      setData(d as DupData);
    } catch (e) {
      if (reqId !== reqIdRef.current) return;
      setError(e instanceof Error ? e.message : "");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, []);

  // Spinner ve hata sıfırlama olay işleyicisinde: effect gövdesinde senkron
  // setState react-hooks/set-state-in-effect kuralını ihlal ediyor. İlk yüklemede
  // loading zaten true başlıyor, o yüzden effect doğrudan load'u çağırıyor.
  const refresh = (m: string, ids: string[]) => {
    setLoading(true);
    setError(null);
    void load(m, ids);
  };

  useEffect(() => { void load(ALL_MONTHS, []); }, [load]);

  // Grup içinde farklı olan alanları vurgulamak için: aynı değilse dikkat çeker.
  const varies = (rows: DupRow[], pick: (r: DupRow) => string | number) =>
    new Set(rows.map(pick)).size > 1;

  return (
    <div className="space-y-6">
      <div className="bg-surface-container border border-outline-variant rounded-2xl p-6">
        <h2 className="text-base font-bold mb-1">{t.title}</h2>
        <p className="text-xs text-on-surface-variant mb-2">{data ? t.desc(data.windowMinutes) : ""}</p>
        <p className="text-xs text-primary mb-4">
          <MIcon name="lock" className="text-sm align-middle mr-1" />
          {t.readOnly}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); refresh(e.target.value, agentIds); }}
            className="bg-surface-container-high border border-outline-variant rounded-xl px-4 py-2.5 text-sm"
          >
            {(data?.availableMonths ?? [ALL_MONTHS]).map((m) => (
              <option key={m} value={m}>{monthLabel(m, lang)}</option>
            ))}
          </select>
          {data && (
            <ConsultantMultiSelect
              agents={data.agents}
              selectedIds={agentIds}
              onChange={(ids) => { setAgentIds(ids); refresh(month, ids); }}
              lang={lang}
            />
          )}
          {data && !loading && (
            <span className="text-xs text-on-surface-variant">
              <strong className="text-on-surface">{data.totals.groups}</strong> {t.groups}
              {" · "}{data.totals.exact} {t.exact}
              {" · "}{data.totals.likely} {t.likely}
              {" · "}{data.totals.extraRows} {t.extra}
            </span>
          )}
        </div>

        {loading && (
          <p className="mt-3 text-xs text-on-surface-variant flex items-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            {t.loading}
          </p>
        )}
        {error !== null && <p className="mt-3 text-xs text-error">{error || t.loadFailed}</p>}
      </div>

      {data && !loading && data.groups.length === 0 && (
        <div className="bg-surface-container border border-outline-variant rounded-2xl p-6">
          <p className="text-sm text-on-surface-variant">{t.empty}</p>
        </div>
      )}

      {data && data.groups.map((g) => {
        const durationVaries = varies(g.rows, (r) => r.callDuration);
        const scoreVaries = varies(g.rows, (r) => r.score);
        return (
          <div key={g.rows[0].id} className="bg-surface-container border border-outline-variant rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 flex-wrap px-5 py-3 bg-surface-container-high border-b border-outline-variant">
              <span
                className={`text-[10px] px-2 py-1 rounded-full font-bold border ${
                  g.tier === "KESIN"
                    ? "bg-error/10 border-error/30 text-error"
                    : "bg-primary/10 border-primary/30 text-primary"
                }`}
              >
                {g.tier === "KESIN" ? t.tierExact : t.tierLikely}
              </span>
              <span className="text-sm font-bold text-on-surface">{g.rows[0].agentName}</span>
              <span className="text-sm text-on-surface-variant">{g.rows[0].customerName}</span>
              <span className="text-xs text-on-surface-variant">
                {g.tier === "KESIN" ? t.exactHint : t.likelyHint(g.minutesApart)}
              </span>
              {g.customerUnknown && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-surface-container border border-outline-variant text-on-surface-variant">
                  {t.unknownCustomer}
                </span>
              )}
            </div>

            <table className="w-full text-sm">
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id} className="border-b border-outline-variant/50 last:border-0">
                    <td className="px-5 py-3 text-on-surface whitespace-nowrap">{stamp(r.callDate, lang)}</td>
                    <td className={`px-3 py-3 whitespace-nowrap ${durationVaries ? "text-error font-bold" : "text-on-surface-variant"}`}>
                      {r.callDuration}
                      {durationVaries && <span className="ml-1 text-[10px] font-normal">({t.diff})</span>}
                    </td>
                    <td className={`px-3 py-3 whitespace-nowrap ${scoreVaries ? "text-error font-bold" : "text-on-surface-variant"}`}>
                      {r.score}
                      {scoreVaries && <span className="ml-1 text-[10px] font-normal">({t.diff})</span>}
                    </td>
                    <td className="px-3 py-3 text-on-surface-variant whitespace-nowrap">
                      {r.callType === "FIRST_CALL" ? t.firstCall : r.callType === "SECOND_CALL" ? t.secondCall : r.callType}
                    </td>
                    <td className="px-3 py-3 text-on-surface-variant text-xs whitespace-nowrap">{r.source}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      {r.coachingDone && (
                        <span className="mr-2 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                          {t.coaching}
                        </span>
                      )}
                      {r.agentRead && (
                        <span className="px-2 py-1 rounded-full bg-surface-container-high border border-outline-variant text-on-surface-variant">
                          {t.read}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <a
                        href={`/evaluation/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-xs font-bold"
                      >
                        {t.open} ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
