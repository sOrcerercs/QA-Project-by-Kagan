import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewAnalysis } from "@/app/lib/analysisPermissions";
import { loadAnalysisPool } from "@/app/lib/analysisPool";
import {
  buildKeywords, selectContext, buildContextBlock, resolveRange, ymd,
} from "@/app/lib/analysisRetrieval";
import { callGeminiChat, type ChatTurn } from "@/app/lib/gemini";

const SYSTEM_PROMPT = `Sen ESTENOVE saç ekimi kliniğinin satış (SDR) çağrılarını inceleyen bir analistsin.

Sana numaralanmış çağrı blokları verilir. Her blok bir müşteri görüşmesinin
transcript'ini ve o görüşme için üretilmiş kalite değerlendirme raporunu içerir.

Kurallar:
- SADECE verilen bloklardaki bilgiye dayan. Blokta olmayan bir şeyi uydurma.
- Her iddiayı çağrı numarasıyla destekle: "(#3, #12)".
- Aradığın bilgi bloklarda yoksa açıkça söyle: "Verilen çağrılarda bunu bulamadım."
- Sayı veya oran verirken paydayı sana bildirilen çağrı sayısından al, uydurma.
  Bir danışmanın oranını verirken o danışmandan kaç çağrı verildiyse onu kullan.
- Alıntı yaparken transcript'ten birebir alıntıla, cümleyi değiştirme.
- Cevabını kullanıcının sorduğu dilde yaz. Kısa ve net ol, gereksiz giriş cümlesi kurma.
- Uzun listelerde madde işareti kullan.
- Takip sorusu önceki cevapta adı geçen bir danışman veya çağrı hakkındaysa
  SADECE o kişi/çağrı hakkında konuş. O kişinin çağrısı bu turda verilen
  bloklarda yoksa "Bu turda <kişi>'nin çağrısı gelmedi, tarih aralığını veya
  danışman filtresini ona göre daraltın" de — başka bir kişi hakkında cevap
  ÜRETME.
- Çağrı başına tek tek karar gerektiren sayım işlerinde (ör. "kaç çağrıda X
  yapıldı") kullanıcıyı Tarama moduna yönlendir: orada her çağrı ayrı
  değerlendirilir ve sayım program tarafından yapılır.`;

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!canViewAnalysis(user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  let body: {
    question?: unknown;
    history?: unknown;
    agentIds?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) return NextResponse.json({ error: "Soru boş olamaz." }, { status: 400 });

  const range = resolveRange(body.startDate, body.endDate, new Date());
  if (!range) {
    return NextResponse.json({ error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." }, { status: 400 });
  }

  const agentIds = Array.isArray(body.agentIds)
    ? body.agentIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

  const history: ChatTurn[] = (Array.isArray(body.history) ? body.history : [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m && typeof m === "object" &&
        ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string"
    )
    .slice(-10) // son 5 soru-cevap çifti yeter; daha fazlası bağlamı gereksiz büyütür
    .map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.content }));

  try {
    const pool = await loadAnalysisPool({
      start: range.start,
      endExclusive: range.endExclusive,
      agentIds,
    });

    const meta = {
      startDate: ymd(range.start),
      endDate: ymd(range.end),
      missingAgents: pool.missingAgents,
      excludedByRole: pool.excludedByRole,
    };

    if (pool.calls.length === 0) {
      return NextResponse.json({
        answer: "Seçtiğiniz tarih aralığında ve danışman filtresinde hiç değerlendirme yok. Filtreyi genişletip tekrar deneyin.",
        meta: { poolCount: 0, usedCount: 0, truncated: false, perAgent: [], ...meta },
      });
    }

    // Takip sorularında önceki cevapta adı geçen danışmanı da anahtar kelimelere
    // taşı; yoksa "bu danışmanın zayıf yönü ne?" sorusunda o kişinin çağrıları
    // havuza hiç girmiyor ve model başka birini anlatıyor.
    const priorAnswer = [...history].reverse().find((t) => t.role === "model")?.text;
    const keywords = buildKeywords(question, priorAnswer);
    const selection = selectContext(pool.calls, keywords);
    const contextBlock = buildContextBlock(selection.selected);

    // Kıyas sorularında modelin paydayı bilmesi şart: her danışmandan kaç çağrı
    // verildiğini söylemezsek oranları uydurma paydalarla kuruyor.
    const denominators =
      selection.perAgent.length > 1
        ? "Danışman başına verilen çağrı sayısı (oranları BU paydalar üzerinden kur): " +
          selection.perAgent.map((p) => `${p.agentName}: ${p.used}`).join(", ") +
          ".\n"
        : "";

    const lastTurn: ChatTurn = {
      role: "user",
      text:
        `İncelenecek çağrılar (${selection.usedCount} çağrı, ${meta.startDate} – ${meta.endDate}):\n` +
        denominators +
        `\n${contextBlock}\n\n---\n\nSORU: ${question}`,
    };

    const answer = await callGeminiChat(SYSTEM_PROMPT, [...history, lastTurn], {
      timeoutMs: 55_000,
      temperature: 0.2,
      maxTokens: 8192,
    });

    return NextResponse.json({
      answer,
      meta: {
        poolCount: selection.poolCount,
        usedCount: selection.usedCount,
        truncated: selection.truncated,
        perAgent: selection.perAgent,
        ...meta,
      },
    });
  } catch (e) {
    console.error("[POST /api/analysis/chat]", e);
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    return NextResponse.json({ error: `Analiz yapılamadı: ${msg}` }, { status: 500 });
  }
}
