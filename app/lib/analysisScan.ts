// Tarama modu: tek bir ikili ölçüt, her çağrı için evet/hayır + kanıt alıntısı,
// kişi başına sayım.
//
// Neden ayrı bir mod: serbest sohbette model çağrı bazında saymayı yapamıyor.
// Prod denemesinde "7/10 çağrı" dedi (payda 15'ti) ve evet/hayır gruplarına aynı
// çağrı listesini yazdı. Burada modelden SADECE çağrı başına karar isteniyor;
// toplama ve oran hesabı kodda yapılıyor (tallyScan), modelde değil.
import type { AnalysisCall } from "@/app/lib/analysisRetrieval";

export type ScanVerdict = "EVET" | "HAYIR" | "BELIRSIZ";

export interface ScanRow {
  call: number; // buildContextBlock'taki 1 tabanlı çağrı numarası
  verdict: ScanVerdict;
  evidence: string;
}

export interface ScanTally {
  agentId: string;
  agentName: string;
  total: number;      // taranan sette bu danışmanın çağrı sayısı
  yes: number;
  no: number;
  unclear: number;
  unanswered: number; // model bu çağrılar için karar döndürmedi
}

const MAX_EVIDENCE_CHARS = 400;

const VERDICT_ALIASES: Record<string, ScanVerdict> = {
  EVET: "EVET", YES: "EVET", VAR: "EVET",
  HAYIR: "HAYIR", NO: "HAYIR", YOK: "HAYIR",
  BELIRSIZ: "BELIRSIZ", UNCLEAR: "BELIRSIZ", UNKNOWN: "BELIRSIZ",
};

export const SCAN_SYSTEM_PROMPT = `Sen ESTENOVE saç ekimi kliniğinin satış çağrılarını tarayan bir denetçisin.

Sana numaralanmış çağrı blokları ve TEK bir ikili ölçüt verilir. Görevin her çağrı
için ölçütün sağlanıp sağlanmadığına karar vermek.

Kurallar:
- Verilen HER çağrı için tam olarak bir karar döndür. Hiçbir çağrıyı atlama.
- Karar yalnızca şunlardan biri: EVET, HAYIR, BELIRSIZ.
- BELIRSIZ'i sadece transcript eksik/kesik olduğunda kullan, kararsız kaldığında değil.
- "evidence" alanına transcript'ten BİREBİR kısa bir alıntı yaz (en fazla bir cümle).
  Karar HAYIR ise ölçütün beklediği şeyin yerine ne söylendiğini alıntıla.
  Alıntı bulunamıyorsa boş string yaz.
- Yorum, özet, giriş cümlesi, toplam sayı YAZMA. Oranları sen hesaplama.
- Yanıtın SADECE şu JSON olsun, başka hiçbir metin olmasın:
{"results":[{"call":1,"verdict":"EVET","evidence":"..."}]}`;

export function buildScanPrompt(criterion: string, contextBlock: string, callCount: number): string {
  return (
    `ÖLÇÜT: ${criterion}\n\n` +
    `Aşağıda ${callCount} çağrı var. Her biri için karar döndür — toplam ${callCount} sonuç bekliyorum.\n\n` +
    `${contextBlock}\n\n---\n\n` +
    `Şimdi ${callCount} çağrının tamamı için JSON kararlarını döndür.`
  );
}

// Modelin JSON'unu ayıklar. Kod bloğu, açıklama cümlesi, İngilizce karar,
// aralık dışı numara, tekrar eden satır gibi sapmalara dayanıklıdır.
export function parseScanResults(text: string, callCount: number): ScanRow[] {
  const raw = extractJson(text);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { results?: unknown }).results)
      ? (parsed as { results: unknown[] }).results
      : [];

  const rows: ScanRow[] = [];
  const seen = new Set<number>();
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const { call, verdict, evidence } = item as { call?: unknown; verdict?: unknown; evidence?: unknown };
    const n = typeof call === "number" ? call : Number.parseInt(String(call), 10);
    if (!Number.isInteger(n) || n < 1 || n > callCount || seen.has(n)) continue;
    const key = typeof verdict === "string" ? verdict.trim().toUpperCase() : "";
    const normalized = VERDICT_ALIASES[key];
    if (!normalized) continue;
    seen.add(n);
    rows.push({
      call: n,
      verdict: normalized,
      evidence: (typeof evidence === "string" ? evidence : "").trim().slice(0, MAX_EVIDENCE_CHARS),
    });
  }
  return rows.sort((a, b) => a.call - b.call);
}

function extractJson(text: string): string | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const objStart = body.indexOf("{");
  const arrStart = body.indexOf("[");
  const start =
    objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
  if (start === -1) return null;
  const closer = body[start] === "{" ? "}" : "]";
  const end = body.lastIndexOf(closer);
  if (end <= start) return null;
  return body.slice(start, end + 1);
}

// Sayım kodda yapılır: modelin aritmetiğine güvenilmiyor.
export function tallyScan(rows: ScanRow[], calls: AnalysisCall[]): ScanTally[] {
  const byNumber = new Map(rows.map((r) => [r.call, r]));
  const byAgent = new Map<string, ScanTally>();

  calls.forEach((c, index) => {
    const tally =
      byAgent.get(c.agentId) ??
      { agentId: c.agentId, agentName: c.agentName, total: 0, yes: 0, no: 0, unclear: 0, unanswered: 0 };
    tally.total++;
    const row = byNumber.get(index + 1);
    if (!row) tally.unanswered++;
    else if (row.verdict === "EVET") tally.yes++;
    else if (row.verdict === "HAYIR") tally.no++;
    else tally.unclear++;
    byAgent.set(c.agentId, tally);
  });

  // Aykırı olan üstte görünsün: evet oranı yüksekten düşüğe.
  const rate = (t: ScanTally) => (t.yes + t.no === 0 ? -1 : t.yes / (t.yes + t.no));
  return [...byAgent.values()].sort(
    (a, b) => rate(b) - rate(a) || b.total - a.total || a.agentName.localeCompare(b.agentName, "tr")
  );
}
