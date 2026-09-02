import { NextRequest, NextResponse } from "next/server";
import { extractReportJson } from "@/app/lib/reportJson";
import prisma from "@/app/lib/prisma";
import { detectCallType } from "@/app/lib/callTypeDetector";
import { callGemini, SCORING_THINKING_BUDGET } from "@/app/lib/gemini";

// Düşünme açık olduğu için bu çağrılar ~40-60 sn sürebiliyor. Bu route'u
// çağıran senkron/cron yolları zaten maxDuration = 300 kullanıyor;
// analiz tarafı daha düşük bir platform varsayılanında kalırsa
// zincirin en zayıf halkası burası olur.
export const maxDuration = 300;

const EXTRACT_NAMES_PROMPT = `Aşağıdaki telefon görüşmesi transkriptini oku ve iki kişiyi belirle:
1. Danışman: Şirketi/kliniği temsil eden, hizmet sunan taraf
2. Müşteri: Potansiyel hasta veya müşteri

YALNIZCA aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{"agentName": "Ad Soyad veya Belirtilmedi", "customerName": "Ad Soyad veya Belirtilmedi"}

Kural: İsim kesin olarak belirlenemediyse "Belirtilmedi" yaz.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const transcript = formData.get("transcript") as string;
    const agentName = formData.get("agentName") as string || "Belirtilmedi";
    const customerName = formData.get("customerName") as string || "Belirtilmedi";
    const callDuration = formData.get("callDuration") as string || "Belirtilmedi";
    const teamName = formData.get("teamName") as string || "Belirtilmedi";
    const requestedCallType = formData.get("callType") as string || "AUTO";
    const extractNames = formData.get("extractNames") === "true";
    // Düşünme yalnızca elle tetiklenen tek analizlerde açılır. Vercel Hobby'de
    // istek tavanı 60 sn; düşünmeli çağrı ~50 sn sürüyor ve toplu senkron
    // aramaları sırayla işlediği için o pencereye sığmıyor.
    // Varsayılan KAPALI: yeni bir çağıran eklenip bu alan unutulursa sonuç
    // "eski kalite" olur, "prod'da zaman aşımı" değil.
    const deepAnalysis = formData.get("deepAnalysis") === "true";

    if (!transcript || transcript.trim().length < 50) {
      return NextResponse.json(
        { error: "Lütfen geçerli bir transkript girin (en az 50 karakter)." },
        { status: 400 }
      );
    }

    // 1. Çağrı tipini belirle
    let callType = requestedCallType;

    if (callType === "AUTO") {
      callType = await detectCallType(transcript);
    }

    // 2. İsim çıkarma
    let detectedAgentName = "Belirtilmedi";
    let detectedCustomerName = "Belirtilmedi";

    if (extractNames) {
      try {
        const raw = (await callGemini(EXTRACT_NAMES_PROMPT, transcript.slice(0, 1200), { maxTokens: 60, temperature: 0 })).trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.agentName && typeof parsed.agentName === "string") detectedAgentName = parsed.agentName;
          if (parsed.customerName && typeof parsed.customerName === "string") detectedCustomerName = parsed.customerName;
        }
      } catch {
        // extraction failed — defaults remain
      }
    }

    // 3. DB'den aktif prompt'u çek
    let activePrompt = await prisma.prompt.findFirst({
      where: { callType: callType as any, isActive: true },
    });

    if (!activePrompt) {
      activePrompt = await prisma.prompt.findFirst({ where: { isActive: true } });
    }

    if (!activePrompt) {
      return NextResponse.json(
        { error: `"${callType}" tipi için aktif prompt bulunamadı. Lütfen admin panelinden prompt ekleyin.` },
        { status: 404 }
      );
    }

    // 4. Değerlendirme prompt'unu oluştur
    const fullPrompt = `${activePrompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${agentName}
Takım: ${teamName}
Müşteri Adı: ${customerName}
Görüşme Süresi: ${callDuration}
Değerlendirme Tarihi: ${new Date().toLocaleString("tr-TR", { month: "long", year: "numeric" })}

=== TRANSKRİPT ===
${transcript}

Yukarıdaki transkripti kurallara göre değerlendir ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

    // 5. Ana analiz
    // Rubrik uygulayan çağrı: düşünme açık, sıcaklık 0 (aynı transkript
    // tur başına farklı skor vermesin).
    const reportText = await callGemini("Sen bir satış koçusun.", fullPrompt, {
      maxTokens: 65536,
      temperature: 0,
      thinkingBudget: deepAnalysis ? SCORING_THINKING_BUDGET : 0,
    });

    const { cleanReport, score, sectionScores, weakCriteria, reportData } = extractReportJson(reportText);

    return NextResponse.json({
      report: cleanReport,
      score,
      callType,
      promptId: activePrompt.id,
      sectionScores,
      weakCriteria,
      reportData,
      detectedAgentName,
      detectedCustomerName,
    });

  } catch (error: any) {
    console.error("[analyze] Unexpected error:", error);
    return NextResponse.json({ error: "Analiz sırasında sunucu hatası oluştu." }, { status: 500 });
  }
}
