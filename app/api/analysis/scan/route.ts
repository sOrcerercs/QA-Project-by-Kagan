// Tarama modu: tek ikili ölçüt → her çağrı için evet/hayır + kanıt → kişi başına
// sayım. Sohbet modundan ayrı bir uç, çünkü çıktı biçimi tablo (metin değil) ve
// sayım modelden değil koddan geliyor.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewAnalysis } from "@/app/lib/analysisPermissions";
import { loadAnalysisPool } from "@/app/lib/analysisPool";
import {
  buildKeywords, selectContext, buildContextBlock, resolveRange, ymd,
} from "@/app/lib/analysisRetrieval";
import {
  SCAN_SYSTEM_PROMPT, buildScanPrompt, parseScanResults, tallyScan,
} from "@/app/lib/analysisScan";
import { callGeminiChat } from "@/app/lib/gemini";

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!canViewAnalysis(user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  let body: {
    criterion?: unknown;
    agentIds?: unknown;
    startDate?: unknown;
    endDate?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const criterion = typeof body.criterion === "string" ? body.criterion.trim() : "";
  if (!criterion) return NextResponse.json({ error: "Ölçüt boş olamaz." }, { status: 400 });

  const range = resolveRange(body.startDate, body.endDate, new Date());
  if (!range) {
    return NextResponse.json({ error: "Başlangıç tarihi bitiş tarihinden sonra olamaz." }, { status: 400 });
  }

  const agentIds = Array.isArray(body.agentIds)
    ? body.agentIds.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

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
        criterion,
        rows: [],
        tally: [],
        note: "Seçtiğiniz tarih aralığında ve danışman filtresinde hiç değerlendirme yok.",
        meta: { poolCount: 0, usedCount: 0, truncated: false, perAgent: [], ...meta },
      });
    }

    // Ölçütün kendisi anahtar kelime kaynağı: havuz sığmıyorsa ölçütle ilgili
    // çağrılar seçilir. Kota mantığı sayesinde her danışmandan eşit sayıda gelir.
    const selection = selectContext(pool.calls, buildKeywords(criterion));
    const contextBlock = buildContextBlock(selection.selected);

    const answer = await callGeminiChat(
      SCAN_SYSTEM_PROMPT,
      [{ role: "user", text: buildScanPrompt(criterion, contextBlock, selection.usedCount) }],
      { timeoutMs: 55_000, temperature: 0, maxTokens: 8192 }
    );

    const parsed = parseScanResults(answer, selection.usedCount);
    if (parsed.length === 0) {
      return NextResponse.json(
        { error: "Tarama sonucu okunamadı — model beklenen biçimde cevap vermedi. Ölçütü tek bir evet/hayır sorusu olacak şekilde yazıp tekrar deneyin." },
        { status: 502 }
      );
    }

    const rows = parsed.map((r) => {
      const call = selection.selected[r.call - 1];
      return {
        call: r.call,
        verdict: r.verdict,
        evidence: r.evidence,
        agentId: call.agentId,
        agentName: call.agentName,
        callDate: ymd(call.callDate),
        customerName: call.customerName,
        score: call.score,
      };
    });

    return NextResponse.json({
      criterion,
      rows,
      tally: tallyScan(parsed, selection.selected),
      meta: {
        poolCount: selection.poolCount,
        usedCount: selection.usedCount,
        truncated: selection.truncated,
        perAgent: selection.perAgent,
        ...meta,
      },
    });
  } catch (e) {
    console.error("[POST /api/analysis/scan]", e);
    const msg = e instanceof Error ? e.message : "Bilinmeyen hata";
    return NextResponse.json({ error: `Tarama yapılamadı: ${msg}` }, { status: 500 });
  }
}
