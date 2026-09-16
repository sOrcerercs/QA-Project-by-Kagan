"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { reasonBadge, reasonText } from "@/app/lib/coachingBriefingText";
import type { AgentBriefing, BriefingPick } from "@/app/lib/coachingBriefing";
import { isoWeekKey } from "@/app/lib/isoWeek";
import styles from "./CoachingBriefingView.module.css";

interface Payload {
  week: string;
  weekStart: string;
  weekEnd: string;
  windowWeeks: number;
  agents: AgentBriefing[];
}

const L = {
  tr: {
    title: "Haftalık Koçluk Brifingi",
    subtitle: "1-1 görüşmesinde konuşulacak çağrılar ve neden onlar",
    prev: "Önceki hafta",
    next: "Sonraki hafta",
    thisWeek: "Bu hafta",
    loading: "Brifing hazırlanıyor…",
    error: "Brifing yüklenemedi.",
    retry: "Tekrar dene",
    empty: "Bu hafta hiç değerlendirme yok.",
    noCalls: "Bu hafta çağrı yok.",
    calls: (n: number) => `${n} çağrı`,
    avg: (n: number) => `ortalama ${n}`,
    shouldHave: "Ne demeliydi:",
    open: "Değerlendirmeyi aç",
    print: "Yazdır",
    markDone: "Koçluk yapıldı olarak işaretle",
    done: "Koçluk yapıldı",
    saving: "Kaydediliyor…",
    saveFailed: "Kaydedilemedi",
  },
  en: {
    title: "Weekly Coaching Briefing",
    subtitle: "Calls to cover in the 1-1, and why those",
    prev: "Previous week",
    next: "Next week",
    thisWeek: "This week",
    loading: "Preparing briefing…",
    error: "Could not load the briefing.",
    retry: "Try again",
    empty: "No evaluations this week.",
    noCalls: "No calls this week.",
    calls: (n: number) => `${n} calls`,
    avg: (n: number) => `avg ${n}`,
    shouldHave: "Should have said:",
    open: "Open evaluation",
    print: "Print",
    markDone: "Mark coaching done",
    done: "Coaching done",
    saving: "Saving…",
    saveFailed: "Could not save",
  },
};

const BADGE_TONE: Record<string, string> = {
  RECURRING_WEAKNESS: "#c2410c",
  BIGGEST_LOSS: "#b91c1c",
  STANDOUT_DOWN: "#b45309",
  STANDOUT_UP: "#15803d",
  GOOD_EXAMPLE: "#15803d",
  ONLY_CALL: "#4b5563",
};

function PickRow({ pick, lang }: { pick: BriefingPick; lang: "tr" | "en" }) {
  const t = L[lang];
  const [done, setDone] = useState(pick.coachingDone);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Bayat düğme koruması. React aynı evaluationId key'iyle bu instance'ı
  // koruduğu için, state yalnızca ilk render'da tohumlanır ve bir daha
  // eşleşmezdi: aynı haftanın yeniden yüklenmesinden sonra ya da başka bir
  // sekmede not yazıldıktan sonra düğme hâlâ görünür kalıyordu. Basılınca
  // paylaşılan uç ({ done: true }, not yok) mevcut coachingNotes'u null'a
  // çekerdi — CoachingTrackingView'in saydığı not silinirdi.
  useEffect(() => { setDone(pick.coachingDone); }, [pick.coachingDone]);

  // Tek yönlü: brifingden yalnızca "yapıldı" işaretlenir. Geri alma ve not
  // yazma mevcut değerlendirme kartında; burada ikinci bir düzenleme yüzeyi
  // açmıyoruz.
  const markDone = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      const res = await fetch(`/api/evaluations/${pick.evaluationId}/coaching`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setDone(true);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--rule)", padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase",
            color: BADGE_TONE[pick.reason] ?? "#4b5563",
          }}
        >
          {reasonBadge(pick.reason, lang)}
        </span>
        {pick.criterionLabel && (
          <span style={{ fontSize: 11, opacity: 0.7 }}>· {pick.criterionLabel}</span>
        )}
        <span style={{ fontSize: 13, fontWeight: 600 }}>{pick.customerName}</span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          {new Date(pick.callDate).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB")}
        </span>
        <span style={{ fontSize: 12, opacity: 0.6 }}>· {pick.score}</span>
        <a href={`/evaluation/${pick.evaluationId}`} style={{ fontSize: 12, marginLeft: "auto" }}>
          {t.open}
        </a>
      </div>

      <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5 }}>
        {reasonText(pick.reason, pick.reasonData, lang)}
      </p>

      {pick.evidence.length > 0 && (
        <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
          {pick.evidence.map((ev, i) => (
            <li
              key={i}
              style={{
                fontSize: 12, lineHeight: 1.5, opacity: 0.85,
                borderLeft: "2px solid var(--rule)", paddingLeft: 10, marginTop: 4,
              }}
            >
              {ev.ts && <span style={{ fontFamily: "var(--font-mono, monospace)", opacity: 0.7 }}>{ev.ts} </span>}
              {ev.speakerLabel && <strong>{ev.speakerLabel}: </strong>}
              {ev.text}
            </li>
          ))}
        </ul>
      )}

      {pick.shouldHaveSaid && (
        <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5 }}>
          <strong>{t.shouldHave} </strong>
          {pick.shouldHaveSaid}
        </p>
      )}

      <div style={{ marginTop: 8, fontSize: 12 }}>
        {done ? (
          <span style={{ color: "#15803d" }}>✓ {t.done}</span>
        ) : (
          <button className={styles.noPrint} onClick={markDone} disabled={saving}>
            {saving ? t.saving : t.markDone}
          </button>
        )}
        {saveFailed && <span style={{ marginLeft: 8, color: "#b91c1c" }}>{t.saveFailed}</span>}
      </div>
    </div>
  );
}

export default function CoachingBriefingView({ lang }: { lang: "tr" | "en" }) {
  const t = L[lang];
  const [week, setWeek] = useState<string | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myId = ++reqId.current;
    setLoading(true);
    setFailed(false);
    try {
      // lang sunucuya gider: kriter etiketi ve "ne demeliydi" satırı karttan
      // dile duyarlı okunuyor, istemcide çevrilemez.
      const qs = new URLSearchParams({ lang });
      if (week) qs.set("week", week);
      const res = await fetch(`/api/reports/coaching-briefing?${qs}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      // Daha yeni bir istek başladıysa bu yanıt bayattır; yazma.
      if (myId !== reqId.current) return;
      setData(json);
    } catch {
      if (myId !== reqId.current) return;
      setFailed(true);
    } finally {
      if (myId === reqId.current) setLoading(false);
    }
  }, [week, lang]);

  useEffect(() => { load(); }, [load]);

  const shiftWeek = (delta: number) => {
    if (!data) return;
    const d = new Date(data.weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeek(isoWeekKey(d));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{t.title}</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.65 }}>{t.subtitle}</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }} className={styles.noPrint}>
          <button onClick={() => shiftWeek(-1)}>{t.prev}</button>
          <button onClick={() => setWeek(null)}>{t.thisWeek}</button>
          <button onClick={() => shiftWeek(1)}>{t.next}</button>
          <button onClick={() => window.print()}>{t.print}</button>
        </div>
      </div>

      {data && (
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
          {data.week} ·{" "}
          {new Date(data.weekStart).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB")} –{" "}
          {new Date(data.weekEnd).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB")}
        </p>
      )}

      {loading && <p style={{ fontSize: 13, opacity: 0.6 }}>{t.loading}</p>}

      {failed && !loading && (
        <p style={{ fontSize: 13 }}>
          {t.error} <button onClick={load}>{t.retry}</button>
        </p>
      )}

      {!loading && !failed && data && data.agents.length === 0 && (
        <p style={{ fontSize: 13, opacity: 0.6 }}>{t.empty}</p>
      )}

      {!loading && !failed && data?.agents.map((a) => (
        <section key={a.agentId} className={styles.agentCard}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>{a.agentName}</h3>
            <span style={{ fontSize: 12, opacity: 0.6 }}>
              {t.calls(a.callCount)}
              {a.averageScore !== null && ` · ${t.avg(a.averageScore)}`}
            </span>
          </div>

          {a.picks.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6, marginTop: 8 }}>{t.noCalls}</p>
          ) : (
            a.picks.map((p) => <PickRow key={p.evaluationId} pick={p} lang={lang} />)
          )}
        </section>
      ))}
    </div>
  );
}
