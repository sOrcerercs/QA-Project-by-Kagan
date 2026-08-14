import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewOkr } from "@/app/lib/okrPermissions";
import { REPORTABLE_ROLES } from "@/app/lib/reportScope";
import {
  FIRST_DATA_MONTH, resolveRange, currentMonth, parseAgentIds, upsellGaps, PERFECT_SCORE,
} from "@/app/lib/okr";
import { extractUpsellLine, type UpsellStatus } from "@/app/lib/upsellClassify";

/**
 * Tanıtımın (Stem Cell / Premium) yapılmadığı ikinci görüşmelerin listesi.
 * Ayrı uçta duruyor çünkü rapor metinleri ortalama 10 KB: tüm ayların eksik
 * listesi 5,7 MB'lık rapor demek ve panel varsayılan kapalı. /api/okr yalnızca
 * başlıktaki sayıyı (gapCount) döndürüyor, satırlar panel açılınca buradan
 * geliyor. Sunucudan yalnızca ayıklanmış "Upsell Durumu" cümlesi çıkıyor,
 * raporun tamamı değil.
 *
 * Çağrı tipi filtresi yok: bu kayıtlar zaten yalnızca SECOND_CALL.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!canViewOkr(user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const nowMonth = currentMonth(new Date());
  const month = req.nextUrl.searchParams.get("month") || nowMonth;

  let range: { start: Date; end: Date };
  let agentIds: string[];
  try {
    range = resolveRange(month, FIRST_DATA_MONTH, nowMonth);
    agentIds = parseAgentIds(req.nextUrl.searchParams.get("agentIds"));
  } catch {
    return NextResponse.json({ error: "Geçersiz filtre." }, { status: 400 });
  }

  try {
    const rows = await prisma.evaluationUpsell.findMany({
      where: {
        // SUNULMADI ve skor sınırı taşınan veriyi kısmak için burada; nihai
        // kural upsellGaps'te — iki taraf ayrışırsa saf fonksiyon kazanır.
        OR: [{ stemCell: "SUNULMADI" }, { premium: "SUNULMADI" }],
        evaluation: {
          callDate: { gte: range.start, lte: range.end },
          callType: "SECOND_CALL",
          score: { lt: PERFECT_SCORE },
          agent: { role: { in: [...REPORTABLE_ROLES] } },
          ...(agentIds.length > 0 ? { agentId: { in: agentIds } } : {}),
        },
      },
      select: {
        stemCell: true,
        premium: true,
        evaluation: {
          select: {
            id: true, score: true, callDate: true, customerName: true, report: true,
            agent: { select: { name: true } },
          },
        },
      },
      orderBy: { evaluation: { callDate: "desc" } },
    });

    const gaps = upsellGaps(
      rows.map((r) => ({
        evaluationId: r.evaluation.id,
        callDate: r.evaluation.callDate,
        agentName: r.evaluation.agent.name,
        customerName: r.evaluation.customerName,
        score: r.evaluation.score,
        stemCell: r.stemCell as UpsellStatus,
        premium: r.premium as UpsellStatus,
        // Sınıflandırmanın dayanağı: raporun "Upsell Durumu" satırı. Yanlış
        // sınıflandırmayı çağrıyı açmadan bu satırdan yakalayabiliyoruz.
        reportLine: extractUpsellLine(r.evaluation.report),
      })),
      "ALL"
    );

    return NextResponse.json({ month, agentIds, rows: gaps });
  } catch (e) {
    console.error("[GET /api/okr/gaps]", e);
    return NextResponse.json({ error: "Eksik listesi yüklenemedi." }, { status: 500 });
  }
}
