import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewAnalysis } from "@/app/lib/analysisPermissions";
import { REPORTABLE_ROLES } from "@/app/lib/reportScope";
import {
  buildKeywords, selectContext, buildContextBlock, type AnalysisCall,
} from "@/app/lib/analysisRetrieval";
import { callGeminiChat, type ChatTurn } from "@/app/lib/gemini";

// app/api/okr/route.ts içindeki UNASSIGNED_AGENT_EMAIL ile aynı olmalı.
const UNASSIGNED_AGENT_EMAIL = "unassigned@estenove.local";

const SYSTEM_PROMPT = `Sen ESTENOVE saç ekimi kliniğinin satış (SDR) çağrılarını inceleyen bir analistsin.

Sana numaralanmış çağrı blokları verilir. Her blok bir müşteri görüşmesinin
transcript'ini ve o görüşme için üretilmiş kalite değerlendirme raporunu içerir.

Kurallar:
- SADECE verilen bloklardaki bilgiye dayan. Blokta olmayan bir şeyi uydurma.
- Her iddiayı çağrı numarasıyla destekle: "(#3, #12)".
- Aradığın bilgi bloklarda yoksa açıkça söyle: "Verilen çağrılarda bunu bulamadım."
- Sayı veya oran verirken hangi çağrıları saydığını belirt.
- Alıntı yaparken transcript'ten birebir alıntıla, cümleyi değiştirme.
- Cevabını kullanıcının sorduğu dilde yaz. Kısa ve net ol, gereksiz giriş cümlesi kurma.
- Uzun listelerde madde işareti kullan.
- Takip sorusu önceki cevapta adı geçen bir danışman veya çağrı hakkındaysa
  SADECE o kişi/çağrı hakkında konuş. O kişinin çağrısı bu turda verilen
  bloklarda yoksa "Bu turda <kişi>'nin çağrısı gelmedi, tarih aralığını veya
  danışman filtresini ona göre daraltın" de — başka bir kişi hakkında cevap
  ÜRETME.`;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

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

  // Tarih aralığı: verilmediyse son 30 gün.
  const end = parseDateOnly(body.endDate) ?? new Date();
  const start =
    parseDateOnly(body.startDate) ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (start > end) {
    return NextResponse.json({ error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." }, { status: 400 });
  }
  // Bitiş gününü tam kapsa.
  const endExclusive = new Date(end);
  endExclusive.setUTCHours(23, 59, 59, 999);

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
    const rows = await prisma.evaluation.findMany({
      where: {
        callDate: { gte: start, lte: endExclusive },
        ...(agentIds.length ? { agentId: { in: agentIds } } : {}),
        agent: {
          role: { in: [...REPORTABLE_ROLES] },
          email: { not: UNASSIGNED_AGENT_EMAIL },
        },
      },
      select: {
        id: true,
        callDate: true,
        callType: true,
        score: true,
        customerName: true,
        transcript: true,
        report: true,
        agent: { select: { name: true } },
      },
      orderBy: { callDate: "desc" },
    });

    const calls: AnalysisCall[] = rows.map((r) => ({
      id: r.id,
      agentName: r.agent?.name ?? "—",
      customerName: r.customerName ?? "—",
      callDate: r.callDate,
      callType: String(r.callType),
      score: r.score,
      transcript: r.transcript ?? "",
      report: r.report ?? "",
    }));

    const meta = { startDate: ymd(start), endDate: ymd(end) };

    if (calls.length === 0) {
      return NextResponse.json({
        answer: "Seçtiğiniz tarih aralığında ve danışman filtresinde hiç değerlendirme yok. Filtreyi genişletip tekrar deneyin.",
        meta: { poolCount: 0, usedCount: 0, truncated: false, ...meta },
      });
    }

    // Takip sorularında önceki cevapta adı geçen danışmanı da anahtar kelimelere
    // taşı; yoksa "bu danışmanın zayıf yönü ne?" sorusunda o kişinin çağrıları
    // havuza hiç girmiyor ve model başka birini anlatıyor.
    const priorAnswer = [...history].reverse().find((t) => t.role === "model")?.text;
    const keywords = buildKeywords(question, priorAnswer);
    const selection = selectContext(calls, keywords);
    const contextBlock = buildContextBlock(selection.selected);

    const lastTurn: ChatTurn = {
      role: "user",
      text:
        `İncelenecek çağrılar (${selection.usedCount} çağrı, ${meta.startDate} – ${meta.endDate}):\n\n` +
        `${contextBlock}\n\n---\n\nSORU: ${question}`,
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
        ...meta,
      },
    });
  } catch (e) {
    console.error("[POST /api/analysis/chat]", e);
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    return NextResponse.json({ error: `Analiz yapılamadı: ${msg}` }, { status: 500 });
  }
}
