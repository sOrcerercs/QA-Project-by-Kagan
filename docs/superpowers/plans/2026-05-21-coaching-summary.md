# Coaching Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her danışman için Gemini ile AI-üretimi gelişim özeti + aksiyon maddeleri; DB'de önbelleklenmiş, yeni eval gelince bayatlar, ScoreView + Takım Raporlarında gösterilir.

**Architecture:** Yeni `CoachingSummary` Prisma modeli özeti saklar (`summary: null` = bayat). `GET /api/scores/coaching-summary` önce DB'ye bakar, yoksa/bayatsa Gemini çağırır, kaydeder, döndürür. `POST /api/scores/coaching-summary/refresh` summary'yi null'a çeker; bir sonraki GET yeniler. `AgentCoachingSummary` client bileşeni bu API'yi tüketir ve ScoreView + LandingPage team reports içinde render edilir.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma (PostgreSQL), Gemini 2.5 Flash (REST), inline CSS vars (mevcut pattern)

---

## File Map

| Dosya | İşlem | Sorumluluk |
|-------|-------|------------|
| `prisma/schema.prisma` | Modify | `CoachingSummary` modeli ekle |
| `prisma/migrations/20260521000000_add_coaching_summary/migration.sql` | Create | DDL — CREATE TABLE + UNIQUE INDEX |
| `app/lib/prisma.ts` | Modify | SCHEMA_VERSION bump |
| `app/lib/gemini.ts` | Create | `callGemini` shared helper (DRY — analyze route'dan çıkar) |
| `app/api/analyze/route.ts` | Modify | Local `callGemini` kaldır, `@/app/lib/gemini`'den import et |
| `app/api/scores/coaching-summary/route.ts` | Create | GET endpoint — veri penceresi, Gemini çağrısı, DB cache |
| `app/api/scores/coaching-summary/refresh/route.ts` | Create | POST endpoint — summary null'a çek |
| `app/api/evaluations/route.ts` | Modify | Eval kaydedince CoachingSummary upsert { summary: null } |
| `app/api/batch/route.ts` | Modify | Aynısı — batch eval yaratınca invalidate et |
| `app/components/shared/AgentCoachingSummary.tsx` | Create | UI bileşeni — skeleton, özet+aksiyon, hata, refresh butonu |
| `app/components/shared/ScoreView.tsx` | Modify | `AgentCoachingSummary` entegrasyonu + `canRefresh` prop |
| `app/components/LandingPage.tsx` | Modify | ScoreView'e `canRefresh` geç; team reports single-agent view'a da ekle |

---

## Task 1: Schema + Migration + SCHEMA_VERSION

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260521000000_add_coaching_summary/migration.sql`
- Modify: `app/lib/prisma.ts`

- [ ] **Step 1: `CoachingSummary` modelini schema'ya ekle**

`prisma/schema.prisma` sonuna ekle (mevcut son model `NegativeKeyword`'ün arkasına):

```prisma
model CoachingSummary {
  id          String    @id @default(cuid())
  agentId     String    @unique
  summary     String?
  actionItems Json?
  generatedAt DateTime?
  evalCount   Int       @default(0)
  updatedAt   DateTime  @updatedAt
}
```

- [ ] **Step 2: Migration dizini ve SQL dosyasını oluştur**

```bash
mkdir -p prisma/migrations/20260521000000_add_coaching_summary
```

`prisma/migrations/20260521000000_add_coaching_summary/migration.sql`:

```sql
CREATE TABLE "CoachingSummary" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "summary" TEXT,
    "actionItems" JSONB,
    "generatedAt" TIMESTAMP(3),
    "evalCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoachingSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoachingSummary_agentId_key" ON "CoachingSummary"("agentId");
```

- [ ] **Step 3: Migration'ı uygula ve Prisma client'ı yeniden üret**

```bash
cd /Users/sorcerer/sdr-analyzer
npx prisma migrate deploy
npx prisma generate
```

Expected: `1 migration applied`, ardından `Generated Prisma Client` çıktısı.

- [ ] **Step 4: SCHEMA_VERSION'ı bump et**

`app/lib/prisma.ts` içinde:

```ts
// Eski:
const SCHEMA_VERSION = "v6-negative-keywords";

// Yeni:
const SCHEMA_VERSION = "v7-coaching-summary";
```

- [ ] **Step 5: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma \
        prisma/migrations/20260521000000_add_coaching_summary/migration.sql \
        app/lib/prisma.ts \
        app/generated/
git commit -m "feat: add CoachingSummary model and migration"
```

---

## Task 2: Shared Gemini helper

**Files:**
- Create: `app/lib/gemini.ts`
- Modify: `app/api/analyze/route.ts`

- [ ] **Step 1: `app/lib/gemini.ts` oluştur**

```typescript
const GEMINI_MODEL = "gemini-2.5-flash";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callGemini(
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
```

- [ ] **Step 2: `app/api/analyze/route.ts`'den local tanımları kaldır, import et**

Dosyayı oku ve şu değişiklikleri yap:

**Kaldır** (satır 1-63 civarındaki local tanımlar):
```typescript
const GEMINI_MODEL = "gemini-2.5-flash";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  // ... tüm fonksiyon gövdesi
}
```

**Ekle** (diğer import'ların yanına):
```typescript
import { callGemini } from "@/app/lib/gemini";
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/lib/gemini.ts app/api/analyze/route.ts
git commit -m "refactor: extract callGemini to shared app/lib/gemini.ts"
```

---

## Task 3: GET /api/scores/coaching-summary

**Files:**
- Create: `app/api/scores/coaching-summary/route.ts`

- [ ] **Step 1: Dosyayı oluştur**

```bash
mkdir -p app/api/scores/coaching-summary
```

`app/api/scores/coaching-summary/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { callGemini } from "@/app/lib/gemini";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  const lang = (req.nextUrl.searchParams.get("lang") ?? "tr") as "tr" | "en";

  if (!agentId) return NextResponse.json({ error: "agentId zorunlu." }, { status: 400 });

  // Auth: AGENT sadece kendini görebilir
  if (user.role === "AGENT" && agentId !== user.id) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  // TEAM_LEADER sadece kendi takımını görebilir
  if (user.role === "TEAM_LEADER" && agentId !== user.id) {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    const target = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
    if (!leadingTeam || target?.teamId !== leadingTeam.id) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    }
  }

  try {
    // 1. Önbellek kontrolü
    const cached = await prisma.coachingSummary.findUnique({ where: { agentId } });
    if (cached?.summary) {
      return NextResponse.json({
        summary: cached.summary,
        actionItems: cached.actionItems as string[],
        generatedAt: cached.generatedAt,
        evalCount: cached.evalCount,
      });
    }

    // 2. Veri penceresi: son 10 günde ≥10 eval → onları kullan; değilse son 10 eval
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const recentEvals = await prisma.evaluation.findMany({
      where: { agentId, callDate: { gte: tenDaysAgo } },
      orderBy: { callDate: "desc" },
    });
    const evals =
      recentEvals.length >= 10
        ? recentEvals
        : await prisma.evaluation.findMany({
            where: { agentId },
            orderBy: { callDate: "desc" },
            take: 10,
          });

    if (evals.length === 0) {
      return NextResponse.json({ error: "Yeterli değerlendirme yok." }, { status: 404 });
    }

    // 3. avgSectionScores
    const withSections = evals.filter(
      (e) => e.sectionScores && typeof e.sectionScores === "object"
    );
    let avgSectionScores: { A: number; B: number; C: number } | null = null;
    if (withSections.length > 0) {
      const totals = withSections.reduce(
        (acc, e) => {
          const ss = e.sectionScores as { A: number; B: number; C: number };
          return { A: acc.A + (ss.A || 0), B: acc.B + (ss.B || 0), C: acc.C + (ss.C || 0) };
        },
        { A: 0, B: 0, C: 0 }
      );
      const n = withSections.length;
      avgSectionScores = {
        A: Math.round(totals.A / n),
        B: Math.round(totals.B / n),
        C: Math.round(totals.C / n),
      };
    }

    // 4. topWeakCriteria (en sık 3)
    const criteriaMap: Record<
      string,
      { label: string; totalScore: number; count: number; coachingNote: string }
    > = {};
    for (const e of evals) {
      if (!Array.isArray(e.weakCriteria)) continue;
      for (const c of e.weakCriteria as Array<{
        id: string;
        label: string;
        score: number;
        coachingNote?: string;
      }>) {
        if (!criteriaMap[c.id]) {
          criteriaMap[c.id] = {
            label: c.label,
            totalScore: 0,
            count: 0,
            coachingNote: c.coachingNote ?? "",
          };
        }
        criteriaMap[c.id].totalScore += c.score;
        criteriaMap[c.id].count += 1;
      }
    }
    const topWeakCriteria = Object.entries(criteriaMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([, v]) => ({
        label: v.label,
        avgScore: Math.round(v.totalScore / v.count),
        count: v.count,
        coachingNote: v.coachingNote,
      }));

    // 5. weeklyProgress (son 4 hafta)
    const now = new Date();
    const weeklyProgress = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w * 7 + now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEvals = evals.filter((e) => {
        const d = new Date(e.callDate);
        return d >= weekStart && d < weekEnd;
      });
      weeklyProgress.push({
        week: `Week ${4 - w}`,
        score:
          weekEvals.length > 0
            ? Math.round(weekEvals.reduce((s, e) => s + e.score, 0) / weekEvals.length)
            : 0,
        calls: weekEvals.length,
      });
    }

    const windowNote =
      recentEvals.length >= 10
        ? lang === "tr"
          ? "Son 10 günün değerlendirmeleri"
          : "Last 10 days of evaluations"
        : lang === "tr"
        ? `Son ${evals.length} değerlendirme`
        : `Last ${evals.length} evaluations`;

    // 6. Gemini prompt
    const systemPrompt =
      lang === "tr"
        ? "Sen deneyimli bir satış koçusun. Danışman performans verilerini analiz edip yapıcı, motive edici gelişim özeti ve somut aksiyon maddeleri üretiyorsun. Yanıtın yalnızca geçerli JSON olmalı, başka hiçbir şey içermemeli."
        : "You are an experienced sales coach. You analyze consultant performance data and produce constructive, motivating development summaries with concrete action items. Your response must be valid JSON only, nothing else.";

    const userMessage = JSON.stringify({
      evalCount: evals.length,
      windowNote,
      avgSectionScores,
      topWeakCriteria,
      weeklyProgress,
      lang,
      instruction:
        lang === "tr"
          ? "Yukarıdaki verilere dayanarak danışman için 3-4 cümlelik yapıcı bir gelişim özeti ve 2-3 somut, bu hafta uygulanabilir aksiyon maddesi üret. Suçlayıcı değil, motive edici bir dil kullan. Sadece şu JSON formatında döndür: {\"summary\": \"...\", \"actionItems\": [\"...\", \"...\"]}"
          : "Based on the above data, generate a 3-4 sentence constructive development summary and 2-3 concrete, actionable items for this week. Use motivating, not blaming language. Return only this JSON format: {\"summary\": \"...\", \"actionItems\": [\"...\", \"...\"]}",
    });

    const raw = await callGemini(systemPrompt, userMessage, {
      maxTokens: 1024,
      temperature: 0.4,
    });

    // Markdown code fences varsa sıyır
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { summary: string; actionItems: string[] };

    // 7. DB'ye kaydet
    const record = await prisma.coachingSummary.upsert({
      where: { agentId },
      create: {
        agentId,
        summary: parsed.summary,
        actionItems: parsed.actionItems,
        generatedAt: new Date(),
        evalCount: evals.length,
      },
      update: {
        summary: parsed.summary,
        actionItems: parsed.actionItems,
        generatedAt: new Date(),
        evalCount: evals.length,
      },
    });

    return NextResponse.json({
      summary: record.summary,
      actionItems: record.actionItems as string[],
      generatedAt: record.generatedAt,
      evalCount: record.evalCount,
    });
  } catch (err) {
    console.error("[coaching-summary]", err);
    return NextResponse.json({ error: "Özet oluşturulamadı." }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/api/scores/coaching-summary/route.ts
git commit -m "feat: add GET /api/scores/coaching-summary endpoint"
```

---

## Task 4: POST /api/scores/coaching-summary/refresh

**Files:**
- Create: `app/api/scores/coaching-summary/refresh/route.ts`

- [ ] **Step 1: Dosyayı oluştur**

```bash
mkdir -p app/api/scores/coaching-summary/refresh
```

`app/api/scores/coaching-summary/refresh/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  if (user.role === "AGENT") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { agentId } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId zorunlu." }, { status: 400 });

  try {
    await prisma.coachingSummary.upsert({
      where: { agentId },
      create: { agentId, summary: null, evalCount: 0 },
      update: { summary: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[coaching-summary/refresh]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/api/scores/coaching-summary/refresh/route.ts
git commit -m "feat: add POST /api/scores/coaching-summary/refresh endpoint"
```

---

## Task 5: Cache invalidation

**Files:**
- Modify: `app/api/evaluations/route.ts`
- Modify: `app/api/batch/route.ts`

### 5a: evaluations/route.ts

- [ ] **Step 1: `app/api/evaluations/route.ts` dosyasını oku**

`app/api/evaluations/route.ts`'i oku — `return NextResponse.json({ evaluation });` satırını bul (satır ~72).

- [ ] **Step 2: Invalidation bloğunu ekle**

`return NextResponse.json({ evaluation });` satırından **hemen önce** ekle:

```typescript
  // Coaching summary cache invalidation — non-blocking
  try {
    await prisma.coachingSummary.upsert({
      where: { agentId },
      create: { agentId, summary: null, evalCount: 0 },
      update: { summary: null },
    });
  } catch (e) {
    console.warn("[evaluations] coaching summary invalidation failed:", e);
  }

  return NextResponse.json({ evaluation });
```

### 5b: batch/route.ts

- [ ] **Step 3: `app/api/batch/route.ts` dosyasını oku**

Evaluation create bloğundan sonraki notification createMany'i bul (satır ~170-185 civarı). Notification createMany'in hemen **sonrasına** ekle:

```typescript
      // Coaching summary cache invalidation
      try {
        await prisma.coachingSummary.upsert({
          where: { agentId: resolvedAgentId },
          create: { agentId: resolvedAgentId, summary: null, evalCount: 0 },
          update: { summary: null },
        });
      } catch (e) {
        console.warn("[batch] coaching summary invalidation failed:", e);
      }
```

- [ ] **Step 4: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 5: Commit**

```bash
git add app/api/evaluations/route.ts app/api/batch/route.ts
git commit -m "feat: invalidate coaching summary cache on new evaluation"
```

---

## Task 6: AgentCoachingSummary component

**Files:**
- Create: `app/components/shared/AgentCoachingSummary.tsx`

- [ ] **Step 1: Dosyayı oluştur**

`app/components/shared/AgentCoachingSummary.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface CoachingData {
  summary: string;
  actionItems: string[];
  generatedAt: string;
  evalCount: number;
}

const L = {
  tr: {
    title: "Gelişim Özeti",
    focus: "Bu hafta odaklan:",
    basis: (n: number, date: string) => `${n} değerlendirme baz alındı · ${date}`,
    refresh: "Yenile",
    error: "Özet oluşturulamadı.",
    retry: "Tekrar dene",
    generating: "Özet hazırlanıyor…",
    noData: "Yeterli değerlendirme verisi yok.",
  },
  en: {
    title: "Development Summary",
    focus: "Focus this week:",
    basis: (n: number, date: string) => `Based on ${n} evaluations · ${date}`,
    refresh: "Refresh",
    error: "Could not generate summary.",
    retry: "Try again",
    generating: "Generating summary…",
    noData: "Not enough evaluation data.",
  },
};

export default function AgentCoachingSummary({
  agentId,
  lang,
  canRefresh,
}: {
  agentId: string;
  lang: "tr" | "en";
  canRefresh: boolean;
}) {
  const t = L[lang];
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/scores/coaching-summary?agentId=${encodeURIComponent(agentId)}&lang=${lang}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) return Promise.reject(res.status);
        return res.json();
      })
      .then((d: CoachingData | null) => setData(d))
      .catch(() => setError(t.error))
      .finally(() => setLoading(false));
  }, [agentId, lang, t.error]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/scores/coaching-summary/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      load();
    } catch {
      setError(t.error);
    } finally {
      setRefreshing(false);
    }
  };

  const card: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 16,
    padding: "20px 24px",
    marginTop: 20,
  };

  if (loading) {
    return (
      <div style={card}>
        <div style={{ height: 14, background: "var(--glass-border)", borderRadius: 4, width: "40%", marginBottom: 14 }} />
        <div style={{ height: 11, background: "var(--glass-border)", borderRadius: 4, width: "90%", marginBottom: 7 }} />
        <div style={{ height: 11, background: "var(--glass-border)", borderRadius: 4, width: "80%", marginBottom: 7 }} />
        <div style={{ height: 11, background: "var(--glass-border)", borderRadius: 4, width: "65%", marginBottom: 18 }} />
        <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "50%", marginBottom: 7 }} />
        <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "45%", marginBottom: 7 }} />
        <div style={{ height: 9, background: "var(--glass-border)", borderRadius: 4, width: "55%", marginBottom: 14 }} />
        <p style={{ fontSize: 11, color: "var(--fg-faint)" }}>{t.generating}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={card}>
        <p style={{ fontSize: 13, color: "#f87171", marginBottom: 10 }}>{error}</p>
        <button
          onClick={load}
          style={{
            fontSize: 12, padding: "6px 14px", borderRadius: 8, cursor: "pointer",
            background: "rgba(59,130,246,.15)", border: "1px solid rgba(59,130,246,.3)",
            color: "var(--accent)",
          }}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={card}>
        <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>{t.noData}</p>
      </div>
    );
  }

  const dateStr = data.generatedAt
    ? new Date(data.generatedAt).toLocaleDateString(
        lang === "tr" ? "tr-TR" : "en-GB",
        { day: "2-digit", month: "short", year: "numeric" }
      )
    : "";

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)", margin: 0 }}>{t.title}</h3>
        {canRefresh && (
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{
              fontSize: 11, padding: "4px 12px", borderRadius: 7,
              cursor: refreshing ? "default" : "pointer",
              background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              color: "var(--fg-faint)", opacity: refreshing ? 0.5 : 1,
            }}
          >
            {refreshing ? "…" : t.refresh}
          </button>
        )}
      </div>

      <p style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.65, margin: "0 0 16px" }}>
        {data.summary}
      </p>

      {data.actionItems && data.actionItems.length > 0 && (
        <div>
          <p style={{
            fontSize: 11, fontWeight: 700, color: "var(--fg-faint)",
            textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px",
          }}>
            {t.focus}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {data.actionItems.map((item, i) => (
              <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>→</span>
                <span style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.5 }}>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 14 }}>
        {t.basis(data.evalCount, dateStr)}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/AgentCoachingSummary.tsx
git commit -m "feat: add AgentCoachingSummary component"
```

---

## Task 7: ScoreView integration

**Files:**
- Modify: `app/components/shared/ScoreView.tsx`

ScoreView şu an `{ data: ScoreData; lang?: "tr" | "en" }` props alıyor. `canRefresh?: boolean` eklenecek ve bileşenin sonuna `AgentCoachingSummary` render edilecek.

- [ ] **Step 1: `app/components/shared/ScoreView.tsx` dosyasını oku**

- [ ] **Step 2: `AgentCoachingSummary` import'unu ekle**

Mevcut import satırlarının sonuna:

```tsx
import AgentCoachingSummary from "@/app/components/shared/AgentCoachingSummary";
```

- [ ] **Step 3: Props interface'ini güncelle**

```tsx
// Eski:
export default function ScoreView({ data, lang = "tr" }: { data: ScoreData; lang?: "tr" | "en" }) {

// Yeni:
export default function ScoreView({
  data,
  lang = "tr",
  canRefresh = false,
}: {
  data: ScoreData;
  lang?: "tr" | "en";
  canRefresh?: boolean;
}) {
```

- [ ] **Step 4: AgentCoachingSummary'yi Recent Calls'ın altına ekle**

`ScoreView`'ın `return` bloğunun içindeki son kapanan `</div>` (Recent Calls section'ı kapatan `</div>`) ile `</div>` (tüm `space-y-6` wrapper'ı kapatan) arasına ekle.

Son kısım şöyle görünmeli:

```tsx
      {/* Recent Calls */}
      <div className="bg-surface-container rounded-3xl p-6 space-y-2">
        {/* ... mevcut içerik ... */}
      </div>

      {/* Coaching Summary */}
      <AgentCoachingSummary
        agentId={agent.id}
        lang={lang}
        canRefresh={canRefresh}
      />
    </div>  {/* space-y-6 wrapper kapanıyor */}
```

- [ ] **Step 5: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 6: Commit**

```bash
git add app/components/shared/ScoreView.tsx
git commit -m "feat: integrate AgentCoachingSummary into ScoreView"
```

---

## Task 8: LandingPage integration

**Files:**
- Modify: `app/components/LandingPage.tsx`

İki yerde ScoreView kullanılıyor:
1. **scores sekmesi** (~satır 1149): `<ScoreView data={scoresData} lang={lang} />`
2. **teamreports sekmesi** (~satır 1350): `<ScoreView data={teamReportScores[...]} lang={lang} />`

- [ ] **Step 1: `app/components/LandingPage.tsx` dosyasını oku** (özellikle 1119-1165 ve 1340-1360 arasını)

- [ ] **Step 2: scores sekmesindeki ScoreView'a `canRefresh` ekle**

Satır ~1149'daki:
```tsx
<ScoreView data={scoresData} lang={lang} />
```

Değiştir:
```tsx
<ScoreView data={scoresData} lang={lang} canRefresh={user.role !== "AGENT"} />
```

- [ ] **Step 3: teamreports sekmesindeki ScoreView'a `canRefresh` ekle**

Satır ~1350'deki:
```tsx
<ScoreView data={teamReportScores[teamReportSelectedIds[0]]} lang={lang} />
```

Değiştir:
```tsx
<ScoreView data={teamReportScores[teamReportSelectedIds[0]]} lang={lang} canRefresh={true} />
```

- [ ] **Step 4: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok.

- [ ] **Step 5: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: wire AgentCoachingSummary into scores and team reports tabs"
```

---

## Self-Review

### Spec coverage check

| Spec Requirement | Task |
|---|---|
| `CoachingSummary` Prisma modeli | Task 1 |
| Migration SQL | Task 1 |
| `GET /api/scores/coaching-summary` — cache hit / miss | Task 3 |
| Veri penceresi mantığı (son 10 gün ≥10 / son 10 eval) | Task 3 |
| AGENT sadece kendi agentId'si | Task 3 |
| TEAM_LEADER kendi takımı | Task 3 |
| Gemini prompt — avgSectionScores, topWeakCriteria, weeklyProgress | Task 3 |
| JSON parse + DB upsert | Task 3 |
| `POST /api/scores/coaching-summary/refresh` | Task 4 |
| AGENT refresh yapamaz | Task 4 |
| Cache invalidation — /api/evaluate | Task 5 |
| Cache invalidation — /api/batch | Task 5 |
| `AgentCoachingSummary` — skeleton, filled, error, retry | Task 6 |
| Refresh butonu `canRefresh === true` ise görünür | Task 6 |
| ScoreView entegrasyonu | Task 7 |
| Takım Raporları entegrasyonu (single agent view) | Task 8 |
| `SCHEMA_VERSION` bump | Task 1 |
| Shared `callGemini` (DRY) | Task 2 |

Tüm spec gereksinimleri karşılandı.

### Placeholder scan

Tüm adımlarda gerçek kod verilmiştir. TBD/TODO yok.

### Type consistency

- `CoachingData.actionItems: string[]` — Task 6 component ile Task 3 API response'u uyumlu.
- `canRefresh: boolean` — Task 6, 7, 8 boyunca tutarlı.
- `agentId: string` — tüm tasklarda tutarlı.
- `lang: "tr" | "en"` — tüm tasklarda tutarlı.
