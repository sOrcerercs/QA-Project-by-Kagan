import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewOkr } from "@/app/lib/okrPermissions";
import { extractUpsellLine, type UpsellBatchItem } from "@/app/lib/upsellClassify";
import { classifyWithFallback, CLASSIFIER_MODEL } from "@/app/lib/upsellClassifier";

// Vercel Hobby'de istek başına 60 sn var. 100 kayıt = 2 Gemini isteği ≈ 30 sn.
const CHUNK = 100;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!canViewOkr(user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  try {
    const pending = await prisma.evaluation.findMany({
      where: { callType: "SECOND_CALL", evaluationUpsell: { is: null } },
      select: { id: true, report: true },
      orderBy: { callDate: "desc" },
      take: CHUNK,
    });

    if (pending.length === 0) {
      return NextResponse.json({ classified: 0, unknown: 0, failed: 0, remaining: 0 });
    }

    // Rapor satırı olmayanlara BILINMIYOR yaz — aksi halde bekleyen havuzundan
    // hiç çıkmaz ve istemci döngüsü sonsuza kadar döner.
    const items: UpsellBatchItem[] = [];
    const indexToId = new Map<number, string>();
    let unknown = 0;

    for (const ev of pending) {
      const line = extractUpsellLine(ev.report);
      if (!line) {
        await prisma.evaluationUpsell.create({
          data: { evaluationId: ev.id, stemCell: "BILINMIYOR", premium: "BILINMIYOR", model: null },
        });
        unknown++;
        continue;
      }
      const i = items.length + 1;
      items.push({ i, line });
      indexToId.set(i, ev.id);
    }

    const verdicts = await classifyWithFallback(items);

    let classified = 0;
    for (const [i, verdict] of verdicts) {
      const evaluationId = indexToId.get(i);
      if (!evaluationId) continue;
      await prisma.evaluationUpsell.create({
        data: {
          evaluationId,
          stemCell: verdict.stemCell,
          premium: verdict.premium,
          customerChosePremium: verdict.customerChosePremium ?? null,
          budgetConstraint: verdict.budgetConstraint ?? null,
          customerFixedChoice: verdict.customerFixedChoice ?? null,
          model: CLASSIFIER_MODEL,
        },
      });
      classified++;
    }

    const remaining = await prisma.evaluation.count({
      where: { callType: "SECOND_CALL", evaluationUpsell: { is: null } },
    });

    return NextResponse.json({
      classified,
      unknown,
      failed: items.length - classified,
      remaining,
    });
  } catch (e) {
    console.error("[POST /api/okr/classify]", e);
    return NextResponse.json({ error: "Sınıflandırma başarısız." }, { status: 500 });
  }
}
