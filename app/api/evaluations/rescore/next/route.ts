import { NextRequest, NextResponse } from "next/server";

// Düşünmeli analiz prod'da ~29-55 sn (ölçüldü). Bu route ASLA birden fazla
// kayıt işlemez — döngü tarayıcıda kurulur (bkz. AdminPanel).
//
// DİKKAT: aşağıdaki 300 bir DİLEK, garanti değil. Gerçek tavanı plan belirler
// (Hobby'de 60 sn) ve platform süreci öldürdüğünde `catch` HİÇ ÇALIŞMAZ —
// yani kilit bırakılmaz, kayıt 5 dk kilitli ve bir deneme hakkı eksik kalır.
// Bu yüzden Gemini çağrısına tavanın ALTINDA kendi zaman aşımımızı veriyoruz:
// süreç öldürülmeden biz kontrollü şekilde hata veriyoruz (geminiBudgetMs).
export const maxDuration = 300;

import prisma from "@/app/lib/prisma";
import { $Enums } from "@/app/generated/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { callGemini, SCORING_THINKING_BUDGET } from "@/app/lib/gemini";
import { extractReportJson, reportJsonFields } from "@/app/lib/reportJson";
import {
  claimNextEvaluation,
  releaseEvaluationLock,
  markDeepScored,
  buildEvaluationPrompt,
  pendingWhere,
  remainingGeminiBudgetMs,
  DEEP_SCORE_GEMINI_MAX_ATTEMPTS,
} from "@/app/lib/deepScore";
import { parseTrDay } from "../route";

export async function POST(req: NextRequest) {
  // Tavan isteğin BAŞINDAN işler; Gemini bütçesi buna göre daraltılır.
  const t0 = Date.now();

  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const from = parseTrDay(body?.from);
  const toDay = parseTrDay(body?.to);
  const to = toDay ? new Date(toDay.getTime() + 24 * 60 * 60 * 1000) : undefined;
  const range = { from, to };

  const target = await claimNextEvaluation(range);
  if (!target) return NextResponse.json({ processed: false, remaining: 0 });

  const kalan = () => prisma.evaluation.count({ where: pendingWhere(range) });

  try {
    if (!target.transcript || target.transcript.trim().length < 50) {
      // Transkript yoksa yeniden değerlendirilemez; damgala ki kuyruğu tıkamasın.
      await markDeepScored(target.id);
      return NextResponse.json({
        processed: true, remaining: await kalan(), evaluationId: target.id,
        before: target.score, after: target.score, customerName: target.customerName,
        note: "transkript yok",
      });
    }

    const activePrompt = await prisma.prompt.findFirst({
      where: { callType: target.callType as $Enums.CallType, isActive: true },
      select: { id: true, content: true },
    });
    if (!activePrompt) throw new Error(`${target.callType} için aktif prompt yok`);

    // timeoutMs + maxAttempts BİRLİKTE verilmek zorunda: callGemini'de abort
    // ağ hatası sayılır ve maxAttempts (varsayılan 5) kadar tekrarlanır.
    // Tek başına timeoutMs yazmak 5 x 52 sn eder, tavanı daha beter aşar.
    const reportText = await callGemini(
      "Sen bir satış koçusun.",
      buildEvaluationPrompt(activePrompt.content, target),
      {
        maxTokens: 65536,
        temperature: 0,
        thinkingBudget: SCORING_THINKING_BUDGET,
        timeoutMs: remainingGeminiBudgetMs(Date.now() - t0),
        maxAttempts: DEEP_SCORE_GEMINI_MAX_ATTEMPTS,
      },
    );

    const extracted = extractReportJson(reportText);

    // Blok üretilmediyse kayda DOKUNMA. reportJsonFields boş bloğu yazmaz;
    // rapor ve skor yenilenirse kayıt yarısı yeni yarısı eski olur ve kart,
    // yeni skorun yanında ESKİ kriterleri gösterir. Betikte de aynı koruma var.
    if (!extracted.reportData) {
      await releaseEvaluationLock(target.id).catch(() => {});
      return NextResponse.json(
        { processed: false, remaining: await kalan(), evaluationId: target.id,
          error: "model zorunlu JSON bloğunu üretmedi" },
        { status: 500 },
      );
    }

    // Skor okunamadıysa mevcut skoru koru — 0 yazma.
    const score =
      extracted.scoreRaw !== null && extracted.scoreRaw >= 0 && extracted.scoreRaw <= 100
        ? extracted.scoreRaw
        : target.score;

    // Rapor yazımı ile damgalama TEK güncellemede: ayrı olsalar arada bir
    // hata olduğunda kayıt "yeni raporlu ama damgasız" kalır, kuyruk onu
    // tekrar alır ve aynı işi bir deneme hakkı daha yakarak yeniden yapar.
    await prisma.evaluation.update({
      where: { id: target.id },
      data: {
        report: extracted.cleanReport,
        score,
        promptId: activePrompt.id,
        ...reportJsonFields(extracted),
        deepScoredAt: new Date(),
        deepScoreLockedAt: null,
      },
    });

    return NextResponse.json({
      processed: true,
      remaining: await kalan(),
      evaluationId: target.id,
      before: target.score,
      after: score,
      customerName: target.customerName,
    });
  } catch (e: unknown) {
    // Damgalanmaz, kilit bırakılır — deneme hakkı varsa yeniden alınır.
    // .catch: kayıt arada silinmişse (P2025) release patlar ve ASIL hatayı
    // gizleyip yanıtsız 500'e çevirirdi.
    await releaseEvaluationLock(target.id).catch(() => {});
    const message = e instanceof Error ? e.message : "bilinmeyen hata";
    return NextResponse.json(
      { processed: false, remaining: await kalan(), evaluationId: target.id, error: message },
      { status: 500 },
    );
  }
}
