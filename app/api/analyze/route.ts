import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

// Hafif sınıflandırma prompt'u — çağrı tipini belirlemek için
const CLASSIFY_PROMPT = `Sen bir satış çağrısı sınıflandırıcısısın. Aşağıdaki transkriptin başlangıcını oku ve çağrı tipini belirle.

Kurallar:
- İlk kez aranan müşteri ise: FIRST_CALL
- Daha önce görüşülmüş, tekrar aranan müşteri ise: SECOND_CALL
- Takip araması (sonuç sorma, hatırlatma) ise: FOLLOW_UP
- Hiçbirine uymuyorsa: GENERAL

YALNIZCA şu kelimelerden birini yaz: FIRST_CALL, SECOND_CALL, FOLLOW_UP, GENERAL`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const transcript = formData.get("transcript") as string;
    const agentName = formData.get("agentName") as string || "Belirtilmedi";
    const customerName = formData.get("customerName") as string || "Belirtilmedi";
    const callDuration = formData.get("callDuration") as string || "Belirtilmedi";
    const teamName = formData.get("teamName") as string || "Belirtilmedi";
    const requestedCallType = formData.get("callType") as string || "AUTO";

    if (!transcript || transcript.trim().length < 50) {
      return NextResponse.json(
        { error: "Lütfen geçerli bir transkript girin (en az 50 karakter)." },
        { status: 400 }
      );
    }

    // 1. Çağrı tipini belirle
    let callType = requestedCallType;

    if (callType === "AUTO") {
      const classifyResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: CLASSIFY_PROMPT },
            { role: "user", content: transcript.slice(0, 500) },
          ],
          max_tokens: 10,
          temperature: 0,
        }),
      });

      if (classifyResponse.ok) {
        const classifyData = await classifyResponse.json();
        const detected = classifyData.choices[0].message.content.trim();
        const validTypes = ["FIRST_CALL", "SECOND_CALL", "FOLLOW_UP", "GENERAL"];
        callType = validTypes.includes(detected) ? detected : "SECOND_CALL";
      } else {
        callType = "SECOND_CALL"; // fallback
      }
    }

    // 2. DB'den aktif prompt'u çek
    const activePrompt = await prisma.prompt.findFirst({
      where: { callType: callType as any, isActive: true },
    });

    if (!activePrompt) {
      return NextResponse.json(
        { error: `"${callType}" tipi için aktif prompt bulunamadı. Lütfen admin panelinden prompt ekleyin.` },
        { status: 404 }
      );
    }

    // 3. Değerlendirme prompt'unu oluştur
    const fullPrompt = `${activePrompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${agentName}
Takım: ${teamName}
Müşteri Adı: ${customerName}
Görüşme Süresi: ${callDuration}
Değerlendirme Tarihi: Nisan 2026

=== TRANSKRİPT ===
${transcript}

Yukarıdaki transkripti kurallara göre değerlendir ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

    // 4. Groq API çağrısı
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: 4000,
        temperature: 0.3,
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error("Groq API hatası: " + errText);
    }

    const groqData = await groqResponse.json();
    const reportText = groqData.choices[0].message.content;

    // 5. Skorun LLM yanıtından çıkarılması
    const scoreMatch = reportText.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
    const score = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : 0;

    return NextResponse.json({
      report: reportText,
      score,
      callType,
      promptId: activePrompt.id,
    });

  } catch (error: any) {
    console.error("API Hatası:", error.message);
    return NextResponse.json(
      { error: "API hatası: " + error.message },
      { status: 500 }
    );
  }
}
