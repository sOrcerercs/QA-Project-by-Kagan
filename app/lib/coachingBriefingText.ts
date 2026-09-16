// Koçluk brifingi gerekçelerinin insan okur karşılığı.
//
// Seçim katmanı (coachingBriefing.ts) dil bilmez, yalnızca kod ve sayı üretir.
// Metin burada. Ürün sahibi cümleyi değiştirmek istediğinde yalnızca bu dosya
// değişir; algoritmaya dokunulmaz.

import type { ReasonCode, ReasonData } from "./coachingBriefing";
import type { Lang } from "./i18n";

const BADGE: Record<ReasonCode, { tr: string; en: string }> = {
  RECURRING_WEAKNESS: { tr: "Tekrar eden zayıflık", en: "Recurring weakness" },
  BIGGEST_LOSS: { tr: "En büyük kayıp", en: "Biggest loss" },
  STANDOUT_UP: { tr: "Sıçrama", en: "Standout" },
  STANDOUT_DOWN: { tr: "Ani düşüş", en: "Sharp drop" },
  GOOD_EXAMPLE: { tr: "İyi örnek", en: "Good example" },
  ONLY_CALL: { tr: "Bu haftanın çağrısı", en: "This week's call" },
};

export function reasonBadge(reason: ReasonCode, lang: Lang): string {
  return BADGE[reason][lang];
}

/** Sayıyı gereksiz ondalıksız yazar: 31 → "31", 2.25 → "2,25" (tr) / "2.25" (en). */
function num(v: number | undefined, lang: Lang): string {
  if (typeof v !== "number") return "—";
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return lang === "tr" ? s.replace(".", ",") : s;
}

export function reasonText(reason: ReasonCode, data: ReasonData, lang: Lang): string {
  const tr = lang === "tr";
  const label = data.criterionLabel ?? (tr ? "aynı kriter" : "the same criterion");

  switch (reason) {
    case "RECURRING_WEAKNESS":
      return tr
        ? `Son ${num(data.windowWeeks, lang)} haftada ${num(data.occurrences, lang)} çağrıda "${label}" zayıf kaldı; bu çağrıda en dibe vurdu.`
        : `"${label}" came up weak in ${num(data.occurrences, lang)} calls over the last ${num(data.windowWeeks, lang)} weeks; it bottomed out here.`;

    case "BIGGEST_LOSS":
      return tr
        ? `Bu haftanın en büyük puan kaybı (−${num(data.loss, lang)}).`
        : `The biggest point loss this week (−${num(data.loss, lang)}).`;

    case "STANDOUT_UP":
      return tr
        ? `Kendi ortalamasının ${num(data.deviation, lang)} puan üstünde (ortalama ${num(data.average, lang)}) — burada ne farklı yaptı?`
        : `${num(data.deviation, lang)} points above their own average (${num(data.average, lang)}) — what was different here?`;

    case "STANDOUT_DOWN":
      return tr
        ? `Kendi ortalamasının ${num(Math.abs(data.deviation ?? 0), lang)} puan altında (ortalama ${num(data.average, lang)}) — bu çağrıda ne oldu?`
        : `${num(Math.abs(data.deviation ?? 0), lang)} points below their own average (${num(data.average, lang)}) — what happened on this call?`;

    case "GOOD_EXAMPLE":
      return tr
        ? `Bu çağrıda iyi yapılan bir nokta var; ekiple paylaşmaya değer.`
        : `Something was done well here; worth sharing with the team.`;

    case "ONLY_CALL":
      return tr
        ? `Bu hafta ${num(data.callCount, lang)} çağrı var; hepsi listede.`
        : `${num(data.callCount, lang)} calls this week; all of them are listed.`;
  }
}
