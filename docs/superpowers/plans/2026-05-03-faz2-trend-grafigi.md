# Faz 2 — Kategori Trend Grafiği Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agent'ın A/B/C bölüm skorlarını haftalar içinde gösteren SVG çizgi grafiğini ve iki trend göstergesini (dönem trendi + son hafta uyarısı) ScoreView'e ekle.

**Architecture:** Yeni `/api/scores/trend` endpoint'i evaluationları ISO haftasına göre gruplar ve hesaplanmış haftalık ortalamaları + iki göstergeyi döner. Yeni `TrendChart` client bileşeni kendi fetch'ini yaparak ScoreView'in mevcut veri akışına dokunmadan kartın altına eklenir.

**Tech Stack:** Next.js 16 App Router, Prisma (PostgreSQL/Supabase), TypeScript, Tailwind CSS, SVG (kütüphane yok)

---

## Dosya Haritası

| Dosya | İşlem | Amaç |
|-------|-------|-------|
| `app/api/scores/trend/route.ts` | Oluştur | Haftalık A/B/C ortalamaları + trend göstergeleri |
| `app/components/shared/TrendChart.tsx` | Oluştur | SVG grafik + toggle + göstergeler |
| `app/components/shared/ScoreView.tsx` | Değiştir | TrendChart'ı Bölüm Analizi kartının altına ekle |

---

## Task 1: Trend API Endpoint

**Files:**
- Create: `app/api/scores/trend/route.ts`

- [ ] **Step 1: Dosyayı oluştur**

`app/api/scores/trend/route.ts` dosyasını oluştur ve aşağıdaki kodu yaz:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

type Range = "4w" | "3m" | "6m" | "all";

const SECTION_LABELS: Record<"A" | "B" | "C", string> = {
  A: "Giriş & Profilleme",
  B: "Çözüm & Otorite",
  C: "Kapanış & Köprü",
};

function getRangeStart(range: Range): Date | null {
  const now = new Date();
  if (range === "4w") { const d = new Date(now); d.setDate(d.getDate() - 28); return d; }
  if (range === "3m") { const d = new Date(now); d.setDate(d.getDate() - 90); return d; }
  if (range === "6m") { const d = new Date(now); d.setDate(d.getDate() - 180); return d; }
  return null;
}

function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

const avg = (arr: number[]) =>
  Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

type Section = "A" | "B" | "C";
type DropIndicator = {
  section: Section;
  label: string;
  from: number;
  to: number;
  delta: number;
} | null;

function calcDrop(
  from: Record<Section, number>,
  to: Record<Section, number>
): DropIndicator {
  const deltas = (["A", "B", "C"] as Section[]).map((k) => ({
    section: k,
    delta: to[k] - from[k],
  }));
  const worst = deltas.sort((a, b) => a.delta - b.delta)[0];
  if (worst.delta >= 0) return null;
  return {
    section: worst.section,
    label: SECTION_LABELS[worst.section],
    from: from[worst.section],
    to: to[worst.section],
    delta: worst.delta,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId") || user.id;
  const range = (req.nextUrl.searchParams.get("range") || "4w") as Range;

  if (user.role === "AGENT" && agentId !== user.id) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  if (!["4w", "3m", "6m", "all"].includes(range)) {
    return NextResponse.json({ error: "Geçersiz range." }, { status: 400 });
  }

  const rangeStart = getRangeStart(range);
  const evaluations = await prisma.evaluation.findMany({
    where: {
      agentId,
      NOT: { sectionScores: null },
      ...(rangeStart && { createdAt: { gte: rangeStart } }),
    },
    select: { createdAt: true, sectionScores: true },
    orderBy: { createdAt: "asc" },
  });

  const weekMap = new Map<
    string,
    { weekStart: Date; A: number[]; B: number[]; C: number[] }
  >();

  for (const e of evaluations) {
    const key = getISOWeekKey(e.createdAt);
    const ss = e.sectionScores as { A: number; B: number; C: number };
    if (!weekMap.has(key)) {
      weekMap.set(key, { weekStart: getWeekStart(e.createdAt), A: [], B: [], C: [] });
    }
    const bucket = weekMap.get(key)!;
    bucket.A.push(ss.A || 0);
    bucket.B.push(ss.B || 0);
    bucket.C.push(ss.C || 0);
  }

  const weeks = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v], idx) => ({
      week: `H${idx + 1}`,
      date: v.weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
      A: avg(v.A),
      B: avg(v.B),
      C: avg(v.C),
      callCount: v.A.length,
    }));

  const hasEnoughData = weeks.length >= 2;

  let periodDrop: DropIndicator = null;
  let lastWeekDrop: DropIndicator = null;

  if (hasEnoughData) {
    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    periodDrop = calcDrop(
      { A: first.A, B: first.B, C: first.C },
      { A: last.A, B: last.B, C: last.C }
    );
    const prev = weeks[weeks.length - 2];
    lastWeekDrop = calcDrop(
      { A: prev.A, B: prev.B, C: prev.C },
      { A: last.A, B: last.B, C: last.C }
    );
  }

  return NextResponse.json({
    weeks,
    trendIndicators: { periodDrop, lastWeekDrop },
    hasEnoughData,
  });
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Beklenen: hata yok.

- [ ] **Step 3: Endpoint'i manuel test et**

Sunucu çalışıyorsa (`npm run dev`) tarayıcıda veya curl ile:

```bash
curl "http://localhost:3000/api/scores/trend?range=4w" \
  -H "Cookie: estenove_token=<geçerli token>" 2>/dev/null | head -c 500
```

Beklenen çıktı (evaluation varsa):
```json
{"weeks":[{"week":"H1","date":"...","A":85,"B":74,"C":61,"callCount":2},...], "trendIndicators":{...}, "hasEnoughData":true}
```

Evaluation yoksa veya sectionScores null ise: `{"weeks":[],"trendIndicators":{"periodDrop":null,"lastWeekDrop":null},"hasEnoughData":false}`

- [ ] **Step 4: Commit**

```bash
git add app/api/scores/trend/route.ts
git commit -m "feat: add /api/scores/trend endpoint for weekly A/B/C averages"
```

---

## Task 2: TrendChart Bileşeni

**Files:**
- Create: `app/components/shared/TrendChart.tsx`

- [ ] **Step 1: Dosyayı oluştur**

`app/components/shared/TrendChart.tsx` dosyasını oluştur:

```tsx
"use client";

import { useState, useEffect } from "react";
import MIcon from "@/app/components/shared/MIcon";

type Range = "4w" | "3m" | "6m" | "all";

interface TrendWeek {
  week: string;
  date: string;
  A: number;
  B: number;
  C: number;
  callCount: number;
}

interface DropIndicator {
  section: "A" | "B" | "C";
  label: string;
  from: number;
  to: number;
  delta: number;
}

interface TrendData {
  weeks: TrendWeek[];
  trendIndicators: {
    periodDrop: DropIndicator | null;
    lastWeekDrop: DropIndicator | null;
  };
  hasEnoughData: boolean;
}

const RANGES: { label: string; value: Range }[] = [
  { label: "4H", value: "4w" },
  { label: "3A", value: "3m" },
  { label: "6A", value: "6m" },
  { label: "Tümü", value: "all" },
];

const SVG_W = 440;
const SVG_H = 130;
const PAD_L = 36;
const PAD_R = 16;
const PAD_T = 12;
const PAD_B = 20;

function chartX(idx: number, total: number): number {
  if (total === 1) return PAD_L + (SVG_W - PAD_L - PAD_R) / 2;
  return PAD_L + (idx / (total - 1)) * (SVG_W - PAD_L - PAD_R);
}

function chartY(val: number): number {
  return PAD_T + (1 - val / 100) * (SVG_H - PAD_T - PAD_B);
}

function polylinePoints(weeks: TrendWeek[], key: "A" | "B" | "C"): string {
  return weeks.map((w, i) => `${chartX(i, weeks.length)},${chartY(w[key])}`).join(" ");
}

export default function TrendChart({ agentId }: { agentId: string }) {
  const [range, setRange] = useState<Range>("4w");
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/scores/trend?agentId=${agentId}&range=${range}`)
      .then((r) => r.json())
      .then((d: TrendData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [agentId, range]);

  return (
    <div className="bg-surface-container rounded-3xl p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-headline text-lg font-bold flex items-center gap-2">
          <MIcon name="show_chart" className="text-primary" />
          Kategori Trendi
        </h3>
        <div className="flex gap-1 bg-surface-container-high rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                range === r.value
                  ? "bg-primary text-on-primary"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : !data || !data.hasEnoughData ? (
        <div className="flex items-center justify-center h-40 text-slate-500 text-sm text-center px-4">
          Trend hesaplanabilmesi için seçili dönemde en az 2 haftalık veri gerekir.
        </div>
      ) : (
        <>
          {/* SVG Chart */}
          <div className="bg-surface-container-high rounded-2xl p-4 mb-4">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full"
              style={{ height: SVG_H }}
            >
              {/* Grid lines */}
              {[25, 50, 75, 100].map((v) => (
                <g key={v}>
                  <line
                    x1={PAD_L}
                    y1={chartY(v)}
                    x2={SVG_W - PAD_R}
                    y2={chartY(v)}
                    stroke="#ffffff08"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD_L - 4}
                    y={chartY(v) + 3}
                    fill="#475569"
                    fontSize="7"
                    textAnchor="end"
                  >
                    {v}
                  </text>
                </g>
              ))}
              {/* X labels */}
              {data.weeks.map((w, i) => (
                <text
                  key={w.week}
                  x={chartX(i, data.weeks.length)}
                  y={SVG_H - 2}
                  fill="#475569"
                  fontSize="7"
                  textAnchor="middle"
                >
                  {w.week}
                </text>
              ))}
              {/* Lines + dots */}
              {(["A", "B", "C"] as const).map((key, ki) => {
                const color =
                  ki === 0 ? "#4ade80" : ki === 1 ? "#facc15" : "#f87171";
                return (
                  <g key={key}>
                    <polyline
                      points={polylinePoints(data.weeks, key)}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    {data.weeks.map((w, i) => (
                      <circle
                        key={i}
                        cx={chartX(i, data.weeks.length)}
                        cy={chartY(w[key])}
                        r="3"
                        fill={color}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
            {/* Legend */}
            <div className="flex gap-5 mt-3 pt-3 border-t border-white/5">
              {[
                { color: "#4ade80", label: "A — Giriş" },
                { color: "#facc15", label: "B — Çözüm" },
                { color: "#f87171", label: "C — Kapanış" },
              ].map((l) => (
                <span
                  key={l.label}
                  className="text-[10px] flex items-center gap-1.5"
                  style={{ color: l.color }}
                >
                  <span
                    className="inline-block w-3 rounded"
                    style={{ height: 2, backgroundColor: l.color }}
                  />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {/* Trend Indicators */}
          {(data.trendIndicators.periodDrop ||
            data.trendIndicators.lastWeekDrop) && (
            <div className="grid grid-cols-2 gap-3">
              {data.trendIndicators.periodDrop && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                    Dönem Trendi
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-red-400 text-xl leading-none">↘</span>
                    <div>
                      <p className="text-red-300 text-xs font-bold">
                        {data.trendIndicators.periodDrop.section} —{" "}
                        {data.trendIndicators.periodDrop.label}
                      </p>
                      <p className="text-red-400 text-[10px]">
                        %{data.trendIndicators.periodDrop.from} → %
                        {data.trendIndicators.periodDrop.to}{" "}
                        <span className="text-slate-500">
                          ({data.trendIndicators.periodDrop.delta})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {data.trendIndicators.lastWeekDrop && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                    Son Hafta Uyarısı
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-xl leading-none">⚠</span>
                    <div>
                      <p className="text-amber-300 text-xs font-bold">
                        {data.trendIndicators.lastWeekDrop.section} —{" "}
                        {data.trendIndicators.lastWeekDrop.label}
                      </p>
                      <p className="text-amber-400 text-[10px]">
                        %{data.trendIndicators.lastWeekDrop.from} → %
                        {data.trendIndicators.lastWeekDrop.to}{" "}
                        <span className="text-slate-500">
                          ({data.trendIndicators.lastWeekDrop.delta})
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Beklenen: hata yok.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/TrendChart.tsx
git commit -m "feat: add TrendChart component with SVG line graph and trend indicators"
```

---

## Task 3: ScoreView Entegrasyonu

**Files:**
- Modify: `app/components/shared/ScoreView.tsx`

- [ ] **Step 1: TrendChart import'unu ekle**

`app/components/shared/ScoreView.tsx` dosyasının en üstündeki import bloğunu bul:

```tsx
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import MIcon from "@/app/components/shared/MIcon";
import { translations } from "@/app/lib/i18n";
```

Şununla değiştir:

```tsx
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import MIcon from "@/app/components/shared/MIcon";
import { translations } from "@/app/lib/i18n";
import TrendChart from "@/app/components/shared/TrendChart";
```

- [ ] **Step 2: TrendChart'ı Bölüm Analizi kartının hemen altına ekle**

`app/components/shared/ScoreView.tsx` içinde bu satırı bul (Bölüm Analizi kartının kapanışı):

```tsx
      )}

      {/* Weekly Progress */}
```

Şununla değiştir:

```tsx
      )}

      <TrendChart agentId={agent.id} />

      {/* Weekly Progress */}
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Beklenen: hata yok.

- [ ] **Step 4: Tarayıcıda doğrula**

`http://localhost:3000` → Agent olarak giriş → Scores sekmesi.

Kontrol listesi:
1. "Kategori Trendi" kartı Bölüm Analizi'nin hemen altında görünüyor
2. Sectionlar yoksa veya veri yetersizse: "Trend hesaplanabilmesi için..." mesajı gösteriliyor
3. Sectionlar varsa: A/B/C çizgileri görünüyor
4. 4H / 3A / 6A / Tümü toggle'larına tıklanınca kart yeniden yükleniyor (spinner → grafik)
5. Düşen kategori varsa göstergeler görünüyor; yoksa (hepsi artış) göstergeler gizleniyor

- [ ] **Step 5: Commit**

```bash
git add app/components/shared/ScoreView.tsx
git commit -m "feat: integrate TrendChart into ScoreView"
```

---

## Self-Review Checklist

- [x] Spec §3 (API endpoint, parametreler, auth, response shape) → Task 1
- [x] Spec §4 (TrendChart bileşeni, toggle, SVG grafik, göstergeler, loading state) → Task 2
- [x] Spec §5 (ScoreView entegrasyonu, Bölüm Analizi altına) → Task 3
- [x] Spec §6 Edge Cases (hasEnoughData: false → mesaj, null sectionScores → dışlama) → Task 1 + Task 2
- [x] Tip tutarlılığı: `TrendWeek`, `DropIndicator`, `TrendData` Task 2'de tanımlanıyor ve Task 1 response'u ile eşleşiyor
