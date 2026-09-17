"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { reasonBadge, reasonText } from "@/app/lib/coachingBriefingText";
import type { AgentBriefing, BriefingPick, ReasonCode } from "@/app/lib/coachingBriefing";
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
    avgLabel: "ort.",
    shouldHave: "Ne demeliydi:",
    open: "Değerlendirmeyi aç",
    print: "Yazdır",
    markDone: "Koçluk yapıldı işaretle",
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
    avgLabel: "avg",
    shouldHave: "Should have said:",
    open: "Open evaluation",
    print: "Print",
    markDone: "Mark coaching done",
    done: "Coaching done",
    saving: "Saving…",
    saveFailed: "Could not save",
  },
};

/**
 * Gerekçe tonu. Değerler CSS değişkeni — sabit hex YAZILMAZ, yoksa koyu/açık
 * temanın birinde kontrast düşer (önceki sürümde #b91c1c koyu temada ~2.5:1
 * kalıyordu). Tonlar uygulamanın mevcut skor skalasıyla aynı ailedir, böylece
 * brifing uygulamanın dilini konuşur.
 *
 * Record<ReasonCode, …>: yeni bir gerekçe kodu eklenirse derleme hatası verir.
 */
const TONE: Record<ReasonCode, string> = {
  RECURRING_WEAKNESS: "var(--tone-warn)",
  BIGGEST_LOSS: "var(--tone-bad)",
  STANDOUT_DOWN: "var(--tone-warn)",
  STANDOUT_UP: "var(--tone-good)",
  GOOD_EXAMPLE: "var(--tone-good)",
  ONLY_CALL: "var(--tone-flat)",
};

/** Skor rengi — LandingPage'deki mevcut konvansiyonun aynısı. */
const scoreTone = (s: number) =>
  s >= 85 ? "var(--tone-good)"
    : s >= 70 ? "var(--accent)"
      : s >= 55 ? "var(--tone-warn)"
        : "var(--tone-bad)";

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

  const locale = lang === "tr" ? "tr-TR" : "en-GB";

  return (
    // --pick-tone sol rayı ve rozeti birlikte besler; ton tek yerde durur.
    <div className={styles.pick} style={{ ["--pick-tone" as string]: TONE[pick.reason] }}>
      <div className={styles.pickHead}>
        <span className={styles.badge}>{reasonBadge(pick.reason, lang)}</span>
        {pick.criterionLabel && <span className={styles.criterion}>{pick.criterionLabel}</span>}
        <span className={styles.customer}>{pick.customerName}</span>
        <span className={styles.pickMeta}>
          {new Date(pick.callDate).toLocaleDateString(locale, { day: "numeric", month: "short" })}
        </span>
        <span className={styles.pickMeta} style={{ color: scoreTone(pick.score) }}>
          {pick.score}
        </span>
        <a className={`${styles.openLink} ${styles.noPrint}`} href={`/evaluation/${pick.evaluationId}`}>
          {t.open} →
        </a>
      </div>

      <p className={styles.reason}>{reasonText(pick.reason, pick.reasonData, lang)}</p>

      {pick.evidence.length > 0 && (
        <ul className={styles.evidence}>
          {pick.evidence.map((ev, i) => (
            <li key={i} className={styles.quote}>
              {ev.ts && <span className={styles.ts}>{ev.ts}</span>}
              {ev.speakerLabel && <span className={styles.speaker}>{ev.speakerLabel}: </span>}
              {ev.text}
            </li>
          ))}
        </ul>
      )}

      {pick.shouldHaveSaid && (
        <p className={styles.shouldHave}>
          <span className={styles.shouldHaveLabel}>{t.shouldHave} </span>
          {pick.shouldHaveSaid}
        </p>
      )}

      <div className={styles.pickFoot}>
        {done ? (
          <span className={styles.doneMark}>✓ {t.done}</span>
        ) : (
          <button
            type="button"
            className={`${styles.primaryBtn} ${styles.noPrint}`}
            onClick={markDone}
            disabled={saving}
          >
            {saving ? t.saving : t.markDone}
          </button>
        )}
        {saveFailed && <span className={styles.failMark}>{t.saveFailed}</span>}
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

  // window.print() tüm uygulama kabuğunu basıyordu — kenar çubuğu, topbar,
  // bildirim zili, mobil sekme çubuğu. Kabuğu gizleyen kural yalnızca bu
  // öznitelik varken geçerli; diğer sayfaların yazdırma davranışı değişmez.
  // (Kural LandingPage.module.css'te: topbar bir <header> değil, class'lı div.)
  const handlePrint = () => {
    document.documentElement.setAttribute("data-printing", "briefing");
    const cleanup = () => {
      document.documentElement.removeAttribute("data-printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  const shiftWeek = (delta: number) => {
    if (!data) return;
    const d = new Date(data.weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeek(isoWeekKey(d));
  };

  const locale = lang === "tr" ? "tr-TR" : "en-GB";
  const dayMonth: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>{t.title}</h2>
          <p className={styles.subtitle}>{t.subtitle}</p>
          {data && (
            <p className={styles.weekLine}>
              {data.week} · {new Date(data.weekStart).toLocaleDateString(locale, dayMonth)}
              {" – "}
              {new Date(data.weekEnd).toLocaleDateString(locale, dayMonth)}
            </p>
          )}
        </div>

        <div className={`${styles.controls} ${styles.noPrint}`}>
          <div className={styles.segment}>
            <button type="button" className={styles.segBtn} onClick={() => shiftWeek(-1)} title={t.prev}>
              ‹
            </button>
            <button type="button" className={styles.segBtn} onClick={() => setWeek(null)}>
              {t.thisWeek}
            </button>
            <button type="button" className={styles.segBtn} onClick={() => shiftWeek(1)} title={t.next}>
              ›
            </button>
          </div>
          <button type="button" className={styles.ghostBtn} onClick={handlePrint}>
            {t.print}
          </button>
        </div>
      </div>

      {loading && <p className={styles.quiet}>{t.loading}</p>}

      {failed && !loading && (
        <p className={styles.quiet}>
          {t.error}{" "}
          <button type="button" className={styles.ghostBtn} onClick={load}>
            {t.retry}
          </button>
        </p>
      )}

      {!loading && !failed && data && data.agents.length === 0 && (
        <p className={styles.quiet}>{t.empty}</p>
      )}

      {!loading && !failed && data?.agents.map((a) => (
        <section key={a.agentId} className={styles.agentCard}>
          <div className={styles.agentHead}>
            <h3 className={styles.agentName}>{a.agentName}</h3>
            <span className={styles.agentMeta}>{t.calls(a.callCount)}</span>
            {a.averageScore !== null && (
              <span className={styles.avgScore} style={{ color: scoreTone(a.averageScore) }}>
                {a.averageScore}
                <span className={styles.avgLabel}>{t.avgLabel}</span>
              </span>
            )}
          </div>

          {a.picks.length === 0 ? (
            <p className={styles.quiet}>{t.noCalls}</p>
          ) : (
            a.picks.map((p) => <PickRow key={p.evaluationId} pick={p} lang={lang} />)
          )}
        </section>
      ))}
    </div>
  );
}
