"use client";

import React from "react";
import {
  buildReportCard,
  scoreBand,
  stripBold,
  type Evidence,
  type FaultItem,
  type PassedItem,
  type Sub,
} from "@/app/lib/reportCard";
import s from "./EvaluationReportCard.module.css";

/**
 * Değerlendirme sonucunu kart hâlinde basar.
 *
 * Mockup'taki tam kart: başlık (müşteri adı, danışman/takım/tarih/süre meta
 * satırı), büyük skor + bant, bölüm ölçerleri, sayaç şeridi, ardından madde
 * kırılımı. Sayfadaki tekrarlar bu yüzden kaldırıldı.
 *
 * TASARIM KURALI — bozma: kriter adı, bölüm adı, ağırlık ve skor bandı
 * bloktan gelir, burada SABİTLENMEZ. Bu dosyada yalnızca arayüz metinleri
 * (satır başlıkları, bölüm başlıkları) koddadır — onlar prompt değişince
 * değişmez. Prompta kriter eklemek/adlandırmak kod değişikliği gerektirmez.
 */

const L = {
  tr: {
    passedTitle: "Doğru yapılanlar",
    faultsTitle: "Kırılan maddeler",
    faultsCount: "puan kaybına göre",
    naTitle: "Bu aramada uygulanmayan maddeler",
    naNote: "Skora dahil edilmedi — ne artı ne eksi etkisi var.",
    flagTitle: "Medikal bayrak",
    flagNote: "skora etkisiz",
    escalationNote: "insan incelemesi gerekiyor",
    coachTitle: "Bu hafta odaklanılacak noktalar",
    items: "madde",
    points: "puan",
    broken: "KIRIK",
    partial: "EKSİK",
    whatHappened: "Ne oldu",
    evidence: "Kanıt",
    shouldHaveSaid: "Ne demeliydi",
    agent: "Danışman",
    customer: "Müşteri",
    tallyPassed: "doğru",
    tallyPartial: "eksik",
    tallyBroken: "kırık",
    tallyNa: "uygulanmadı",
    criterionScore: "kriter skoru",
    sparseNote: "Bu değerlendirme dar formatta üretildi — kanıt alıntıları ve öneri satırları yok.",
    notScorable: "Bu arama puanlanamadı",
    notScorableNote: "Görüşme puanlanabilir bir satış konuşması değil; skora ve ortalamalara dahil edilmez.",
    hardFailTitle: "Ağır ihlal",
    hardFailNote: "Bu ihlal nedeniyle genel skor sıfırlandı. Bölüm skorları hesaplanmış hâliyle korunur.",
    eyebrow: "Çağrı Değerlendirmesi",
  },
  en: {
    passedTitle: "Done right",
    faultsTitle: "Criteria missed",
    faultsCount: "by points lost",
    naTitle: "Not applicable on this call",
    naNote: "Excluded from the score — no positive or negative effect.",
    flagTitle: "Medical flag",
    flagNote: "no score impact",
    escalationNote: "human review required",
    coachTitle: "Focus points for this week",
    items: "items",
    points: "pts",
    broken: "BROKEN",
    partial: "PARTIAL",
    whatHappened: "What happened",
    evidence: "Evidence",
    shouldHaveSaid: "What to say",
    agent: "Consultant",
    customer: "Customer",
    tallyPassed: "passed",
    tallyPartial: "partial",
    tallyBroken: "broken",
    tallyNa: "not applicable",
    criterionScore: "criterion score",
    sparseNote: "This evaluation was produced in a narrow format — evidence quotes and suggested lines are not available.",
    notScorable: "This call could not be scored",
    notScorableNote: "The call is not a scorable sales conversation; it is excluded from the score and averages.",
    hardFailTitle: "Hard fail",
    hardFailNote: "The overall score was zeroed by this violation. Section scores keep their calculated values.",
    eyebrow: "Call Evaluation",
  },
} as const;

type Lang = keyof typeof L;

export interface EvaluationReportCardProps {
  lang: Lang;
  /** Genel skor — büyük rakam ve (blok band vermezse) bant metni için. */
  score?: number | null;
  /** Kart başlığı. Verilmezse başlık bloğu çizilmez. */
  header?: {
    customerName?: string | null;
    agentName?: string | null;
    teamName?: string | null;
    callDate?: string | null;
    callDuration?: string | null;
    callTypeLabel?: string | null;
  };
  /** Eski kayıtlarda blok dışında duran bölüm skorları — geri düşüş. */
  sectionScores?: unknown;
  /** `Evaluation.reportData` — yeni zengin şema. */
  reportData?: unknown;
  /** `Evaluation.weakCriteria` — reportData yoksa geri düşülen eski şema. */
  weakCriteria?: unknown;
  className?: string;
}

/* ─────────────────────────────── yardımcılar ────────────────────────────── */

function meterColor(v: number): string {
  if (v >= 70) return "var(--good)";
  if (v >= 50) return "var(--warn)";
  return "var(--bad)";
}

function bandClass(score: number): string {
  if (score >= 70) return s.bandGood;
  if (score >= 55) return s.bandWarn;
  return s.bandBad;
}

function scoreClass(score: number): string {
  if (score >= 70) return s.scoreGood;
  if (score >= 55) return s.scoreWarn;
  return s.scoreBad;
}

/**
 * Puan biçimi: en az bir ondalık — mockup'taki gibi "3,0 / 3,0", "0,5 / 0,5".
 * Karışık ondalık ("3 / 3" ile "1,5 / 1,5" yan yana) dağınık görünüyordu.
 */
function fmt(n: number, lang: Lang): string {
  return n.toLocaleString(lang === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

/**
 * Alıntı içindeki kritik parçaları kalınlaştırır. dangerouslySetInnerHTML
 * kullanılmaz — parçalar metin düğümü olarak bölünür, model ne gönderirse
 * göndersin HTML olarak yorumlanmaz.
 */
function highlightText(text: string, highlights: string[]): React.ReactNode {
  if (highlights.length === 0) return text;

  const ranges: Array<[number, number]> = [];
  for (const h of highlights) {
    const at = text.indexOf(h);
    if (at < 0) continue;
    const end = at + h.length;
    // Çakışan aralıkları atla — iç içe <b> üretmenin anlamı yok.
    if (ranges.some(([rs, re]) => at < re && end > rs)) continue;
    ranges.push([at, end]);
  }
  if (ranges.length === 0) return text;
  ranges.sort((a, b) => a[0] - b[0]);

  const out: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) out.push(text.slice(cursor, start));
    out.push(<b key={i}>{text.slice(start, end)}</b>);
    cursor = end;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** Modelin serbest metne yazdığı **kalın** işaretlerini gerçek kalına çevirir. */
function Rich({ children }: { children: string | null }) {
  if (!children) return null;
  const { text, spans } = stripBold(children);
  return <>{highlightText(text, spans)}</>;
}

/* ──────────────────────────────── parçalar ──────────────────────────────── */

function Quotes({ evidence, lang }: { evidence: Evidence[]; lang: Lang }) {
  const t = L[lang];
  return (
    <>
      {evidence.map((e, i) => (
        <div key={i} className={s.quote}>
          {(e.speaker !== "other" || e.speakerLabel || e.ts) && (
            <>
              <span className={s.who}>
                {e.speaker === "agent" ? t.agent : e.speaker === "customer" ? t.customer : (e.speakerLabel ?? "")}
                {e.ts && <span className={s.ts}>{e.ts}</span>}
              </span>
              <br />
            </>
          )}
          {highlightText(e.text, e.highlights)}
          {e.note && <span className={s.who}> {e.note}</span>}
        </div>
      ))}
    </>
  );
}

function Subs({ items, inline }: { items: Sub[]; inline?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className={`${s.subs} ${inline ? s.subsInline : ""}`}>
      {items.map((sub, i) => (
        <span key={i} className={`${s.sub} ${sub.ok ? s.subOk : s.subNo}`}>
          {sub.ok ? "✓" : "✗"} {sub.label}
        </span>
      ))}
    </div>
  );
}

function PassedCard({ item, lang }: { item: PassedItem; lang: Lang }) {
  return (
    <div className={s.pass}>
      <div className={s.ptop}>
        <span className={s.tick}>✓</span>
        <span className={s.ttl}>
          {item.id} · {item.label}
        </span>
        {item.earned !== null && item.max !== null && (
          <span className={s.pts}>
            {fmt(item.earned, lang)} / {fmt(item.max, lang)}
          </span>
        )}
      </div>
      {(item.summary || item.subs.length > 0 || item.evidence.length > 0) && (
        <div className={s.pbody}>
          {item.summary && <div className={s.txt}><Rich>{item.summary}</Rich></div>}
          <Subs items={item.subs} />
          {item.evidence.length > 0 && (
            <div>
              <Quotes evidence={item.evidence} lang={lang} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FaultCard({ item, rank, lang }: { item: FaultItem; rank: number; lang: Lang }) {
  const t = L[lang];
  const broken = item.severity === "broken";
  return (
    <div className={`${s.fault} ${broken ? s.fBad : s.fWarn}`}>
      <div className={s.fhead}>
        <div className={s.rank}>{rank}</div>
        <div className={s.name}>
          {item.id} · {item.label}
        </div>
        <div className={s.chip}>{broken ? t.broken : t.partial}</div>
        {item.loss !== null ? (
          <div className={s.loss}>−{fmt(item.loss, lang)}</div>
        ) : item.altScore !== null ? (
          <div className={s.loss} title={t.criterionScore}>
            {item.altScore}
          </div>
        ) : null}
      </div>
      <div className={s.fbody}>
        {(item.whatHappened || item.note || item.subs.length > 0) && (
          <div className={s.row}>
            <div className={s.lab}>{t.whatHappened}</div>
            <div className={s.val}>
              <Rich>{item.whatHappened}</Rich>
              {item.note && <span className={s.inlineNote}> <Rich>{item.note}</Rich></span>}
              <Subs items={item.subs} inline />
            </div>
          </div>
        )}
        {item.evidence.length > 0 && (
          <div className={s.row}>
            <div className={s.lab}>{t.evidence}</div>
            <div className={s.val}>
              <Quotes evidence={item.evidence} lang={lang} />
            </div>
          </div>
        )}
        {item.shouldHaveSaid && (
          <div className={s.row}>
            <div className={s.lab}>{t.shouldHaveSaid}</div>
            <div className={s.val}>
              <div className={s.say}><Rich>{item.shouldHaveSaid}</Rich></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHead({ title, count }: { title: string; count?: string }) {
  return (
    <div className={s.sec}>
      <h3>{title}</h3>
      <div className={s.rule} />
      {count && <div className={s.count}>{count}</div>}
    </div>
  );
}

/* ──────────────────────────────── bileşen ───────────────────────────────── */

export default function EvaluationReportCard({
  lang,
  score,
  header,
  sectionScores,
  reportData,
  weakCriteria,
  className,
}: EvaluationReportCardProps) {
  const t = L[lang];
  const card = buildReportCard({ reportData, weakCriteria, sectionScores, lang });

  // Sıra önemli: puanlanamayan aramada blok baştan boş gelir, bu yüzden
  // scorable kontrolü isEmpty'den ÖNCE yapılmalı — yoksa kart hiç çizilmez.
  if (!card.scorable) {
    return (
      <div className={`${s.root} ${className ?? ""}`}>
        <div className={s.na}>
          <div className={s.naItem}>
            <b>{t.notScorable}</b>
            {card.classification && <span className={s.inlineNote}> · {card.classification}</span>}
          </div>
          <div className={s.naNote}>{t.notScorableNote}</div>
        </div>
      </div>
    );
  }

  if (card.isEmpty) return null;

  const meters = card.sections;
  const bandText = card.band ?? (typeof score === "number" ? scoreBand(score, lang) : null);
  const metaLine = header
    ? [header.agentName, header.teamName, header.callDate, header.callDuration]
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .join(" · ")
    : null;

  const passedPoints = card.passed.reduce((sum, p) => sum + (p.earned ?? 0), 0);
  const totalLoss = card.faults.reduce((sum, f) => sum + (f.loss ?? 0), 0);

  return (
    <div className={`${s.root} ${className ?? ""}`}>
      <div className={s.head}>
        {header && (
          <>
            <div className={s.eyebrow} style={{ marginBottom: "0.5rem" }}>
              {t.eyebrow}
              {header.callTypeLabel ? ` · ${header.callTypeLabel}` : ""}
            </div>
            {header.customerName && <h2>{header.customerName}</h2>}
            {metaLine && <div className={s.meta}>{metaLine}</div>}
          </>
        )}

        <div className={s.scorebar}>
          {typeof score === "number" && (
            <div>
              <div className={s.big}>
                <b className={scoreClass(score)}>{score}</b>
                <span>/ 100</span>
              </div>
              {bandText && (
                <div
                  className={`${s.band} ${bandClass(score)}`}
                  style={{ display: "inline-block", marginTop: "0.625rem" }}
                >
                  {bandText}
                </div>
              )}
            </div>
          )}
          {typeof score !== "number" && bandText && (
            <div className={`${s.band} ${bandClass(0)}`}>{bandText}</div>
          )}
          {meters.length > 0 && (
            <div className={s.meters}>
              {meters.map(({ key, label, score: value }) => (
                <div key={key}>
                  <div className={s.mtop}>
                    <i>{label ? `${key} · ${label}` : key}</i>
                    <b>{value}</b>
                  </div>
                  <div className={s.track}>
                    <div
                      className={s.fill}
                      style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: meterColor(value) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {(
            <div className={s.tally}>
              {card.tally.passed > 0 && (
                <span>
                  <i className={s.dot} style={{ background: "var(--good)" }} /> {card.tally.passed} {t.tallyPassed}
                </span>
              )}
              {card.tally.partial > 0 && (
                <span>
                  <i className={s.dot} style={{ background: "var(--warn)" }} /> {card.tally.partial} {t.tallyPartial}
                </span>
              )}
              {card.tally.broken > 0 && (
                <span>
                  <i className={s.dot} style={{ background: "var(--bad)" }} /> {card.tally.broken} {t.tallyBroken}
                </span>
              )}
              {card.tally.na > 0 && (
                <span>
                  <i className={s.dot} style={{ background: "var(--mute)" }} /> {card.tally.na} {t.tallyNa}
                </span>
              )}
              {card.points && (
                <span className={s.points}>
                  {fmt(card.points.earned, lang)} / {fmt(card.points.max, lang)} {t.points}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {card.hardFail && (
        <div className={s.hardFail}>
          <div className={s.hardFailIcon}>!</div>
          <div>
            <div className={s.hardFailTitle}>{t.hardFailTitle}</div>
            <div className={s.hardFailNote}>{t.hardFailNote}</div>
          </div>
        </div>
      )}

      {card.isSparse && <div className={s.legacyNote}>{t.sparseNote}</div>}

      {card.passed.length > 0 && (
        <>
          <SectionHead
            title={t.passedTitle}
            count={`${card.passed.length} ${t.items}${passedPoints > 0 ? ` · ${fmt(passedPoints, lang)} ${t.points}` : ""}`}
          />
          <div className={s.stack}>
            {card.passed.map((p) => (
              <PassedCard key={p.id} item={p} lang={lang} />
            ))}
          </div>
        </>
      )}

      {card.faults.length > 0 && (
        <>
          <SectionHead
            title={t.faultsTitle}
            count={totalLoss > 0 ? `${t.faultsCount} · −${fmt(totalLoss, lang)}` : `${card.faults.length} ${t.items}`}
          />
          <div className={s.stack}>
            {card.faults.map((f, i) => (
              <FaultCard key={f.id} item={f} rank={i + 1} lang={lang} />
            ))}
          </div>
        </>
      )}

      {card.na.length > 0 && (
        <>
          <SectionHead title={t.naTitle} count={`${card.na.length} ${t.items}`} />
          <div className={s.na}>
            {card.na.map((n) => (
              <div key={n.id} className={s.naItem}>
                <b>
                  {n.id} · {n.label}
                </b>
                {n.reason && <> — <Rich>{n.reason}</Rich></>}
              </div>
            ))}
            <div className={s.naNote}>{t.naNote}</div>
          </div>
        </>
      )}

      {card.flags.length > 0 && (
        <>
          <SectionHead
            title={t.flagTitle}
            count={card.flags.some((f) => f.escalation) ? t.escalationNote : t.flagNote}
          />
          {card.flags.map((f, i) => (
            <div key={i} className={`${s.flag} ${f.escalation ? s.flagEscalation : ""}`}>
              <div className={s.flagIcon}>{f.escalation ? "🚨" : "⚕"}</div>
              <div>
                <div className={s.flagTitle}>
                  {f.title}
                  {f.qualifier && <span className={s.flagQualifier}> ({f.qualifier})</span>}
                </div>
                {f.detail && <div className={s.flagDetail}><Rich>{f.detail}</Rich></div>}
              </div>
            </div>
          ))}
        </>
      )}

      {card.coaching.length > 0 && (
        <div className={s.coach}>
          <div className={s.eyebrow}>{t.coachTitle}</div>
          <ol>
            {card.coaching.map((c, i) => (
              <li key={i}>
                <div>
                  <div className={s.ct}>{c.title}</div>
                  {c.detail && <div className={s.cd}><Rich>{c.detail}</Rich></div>}
                  {c.source && <div className={s.cs}>{c.source}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
