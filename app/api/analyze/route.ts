import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { detectCallType } from "@/app/lib/callTypeDetector";

const GEMINI_MODEL = "gemini-2.5-flash";

const EXTRACT_NAMES_PROMPT = `Aşağıdaki telefon görüşmesi transkriptini oku ve iki kişiyi belirle:
1. Danışman: Şirketi/kliniği temsil eden, hizmet sunan taraf
2. Müşteri: Potansiyel hasta veya müşteri

YALNIZCA aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{"agentName": "Ad Soyad veya Belirtilmedi", "customerName": "Ad Soyad veya Belirtilmedi"}

Kural: İsim kesin olarak belirlenemediyse "Belirtilmedi" yaz.`;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY tanımlı değil.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 65536,
      temperature: opts.temperature ?? 0.3,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let response!: Response;
  for (let attempt = 0; attempt < 5; attempt++) {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (response.ok) break;
    if (response.status === 429 && attempt < 4) {
      const retryAfter = response.headers.get("retry-after");
      const wait = retryAfter ? (parseInt(retryAfter, 10) + 3) * 1000 : 15000;
      await sleep(wait);
      continue;
    }
    break;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Google AI API hatası: ${response.status} — ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Google AI yanıtı boş geldi.");
  return text;
}

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
    const reportText = await callGemini("Sen bir satış koçusun.", fullPrompt, { maxTokens: 65536, temperature: 0.3 });

    // JSON_DATA bloğunu çek
    const jsonBlockMatch = reportText.match(/===JSON_DATA===([\s\S]*?)===END_JSON===/);
    let sectionScores: { A: number; B: number; C: number } | null = null;
    let weakCriteria: Array<{ id: string; label: string; score: number; coachingNote: string }> | null = null;

    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1].trim());
        if (parsed.sectionScores && typeof parsed.sectionScores === "object") sectionScores = parsed.sectionScores;
        if (Array.isArray(parsed.weakCriteria)) weakCriteria = parsed.weakCriteria;
      } catch (err) {
        console.warn("[analyze] JSON_DATA block parse failed — sectionScores and weakCriteria will be null:", err);
      }
    }

    const cleanReport = reportText.replace(/\n*===JSON_DATA===[\s\S]*?===END_JSON===/g, "").trim();

    const scoreMatch = cleanReport.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
    const score = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : 0;

    return NextResponse.json({
      report: cleanReport,
      score,
      callType,
      promptId: activePrompt.id,
      sectionScores,
      weakCriteria,
      detectedAgentName,
      detectedCustomerName,
    });

  } catch (error: any) {
    console.error("[analyze] Unexpected error:", error);
    return NextResponse.json({ error: "Analiz sırasında sunucu hatası oluştu." }, { status: 500 });
  }
}
