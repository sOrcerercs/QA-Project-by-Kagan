import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { callGemini } from "@/app/lib/gemini";

export const maxDuration = 60;

const TRANSLATE_SYSTEM_PROMPT =
  "You are a professional translator. Translate the following Turkish call-quality " +
  "evaluation criteria into natural, fluent English. Preserve the original structure, " +
  "line breaks, numbering, headings and any formatting exactly. Translate only — do not " +
  "summarize, add commentary, or answer the content. Return only the translated text.";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Aktif promptları listele — salt-okunur, tüm giriş yapmış roller (AGENT dahil).
// ?lang=en ile içerik İngilizce'ye çevrilir (önbellekli, görüntüleme amaçlı).
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "tr";

  const prompts = await prisma.prompt.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      callType: true,
      content: true,
      version: true,
      updatedAt: true,
      contentEn: true,
      contentEnHash: true,
    },
    orderBy: [{ callType: "asc" }],
  });

  // Türkçe: orijinal içerik aynen döner.
  if (lang === "tr") {
    return NextResponse.json({
      prompts: prompts.map(({ contentEn, contentEnHash, ...p }) => p),
    });
  }

  // İngilizce: hash eşleşiyorsa önbellekten, değilse çevir + önbelleğe yaz.
  // Promptlar paralel çevrilir; bir çeviri hata verirse Türkçe içeriğe geri düşülür.
  const translated = await Promise.all(
    prompts.map(async (p) => {
      const hash = sha256(p.content);
      if (p.contentEn && p.contentEnHash === hash) {
        return { ...p, content: p.contentEn };
      }
      try {
        const en = (await callGemini(TRANSLATE_SYSTEM_PROMPT, p.content, {
          temperature: 0.1,
        })).trim();
        if (en) {
          await prisma.prompt.update({
            where: { id: p.id },
            data: { contentEn: en, contentEnHash: hash },
          });
          return { ...p, content: en };
        }
      } catch (e) {
        console.error(`[prompts/active] translation failed for ${p.id}:`, e);
      }
      // Güvenli geri düşüş: orijinal Türkçe içerik.
      return { ...p, content: p.content };
    })
  );

  return NextResponse.json({
    prompts: translated.map(({ contentEn, contentEnHash, ...p }) => p),
  });
}
