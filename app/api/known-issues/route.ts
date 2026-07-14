import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canEditQa } from "@/app/lib/qaPermissions";
import { validateIssueInput, sortKnownIssues } from "@/app/lib/knownIssues";

// Bilinen sorunları getir (tüm giriş yapmış kullanıcılar)
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  try {
    const issues = await prisma.knownIssue.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ issues: sortKnownIssues(issues) });
  } catch (e) {
    console.error("[GET /api/known-issues]", e);
    return NextResponse.json({ error: "Sorunlar yüklenemedi." }, { status: 500 });
  }
}

// Yeni sorun ekle (sadece admin@estenove.com)
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !canEditQa(user.email)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const result = validateIssueInput(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const issue = await prisma.knownIssue.create({
      data: { ...result.value, createdById: user.id },
    });
    return NextResponse.json({ issue });
  } catch (e) {
    console.error("[POST /api/known-issues]", e);
    return NextResponse.json({ error: "Sorun oluşturulamadı." }, { status: 500 });
  }
}
