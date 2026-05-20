# Negative Keywords Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADMIN ve MANAGER'ın belirlediği negatif kelimeleri tüm çağrı transcript'lerinde tarayan, özet + drill-down sonuçları gösteren bir rapor ekranı inşa etmek.

**Architecture:** Yeni `NegativeKeyword` Prisma modeli keyword'leri DB'de saklar. Rapor endpoint'i tüm transcript'leri sunucu tarafında JS ile tarar (Türkçe karakter için `toLowerCase()` eşleşmesi). Sidebar'da "Raporlar" başlığı ADMIN/MANAGER için genişleyebilir bir gruba dönüşür.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma (PostgreSQL), Tailwind CSS, mevcut `DateRangePicker` component.

---

## File Map

| Dosya | İşlem | Ne yapar |
|---|---|---|
| `prisma/schema.prisma` | Modify | `NegativeKeyword` modeli eklenir |
| `prisma/migrations/20260520000000_add_negative_keywords/migration.sql` | Create | Migration SQL |
| `app/api/negative-keywords/route.ts` | Create | GET (liste) + POST (ekle) |
| `app/api/negative-keywords/[id]/route.ts` | Create | DELETE |
| `app/api/reports/negative-keywords/route.ts` | Create | GET — raporu çalıştırır |
| `app/components/shared/NegativeKeywordsReport.tsx` | Create | UI component (yönetim + filtre + sonuçlar) |
| `app/components/LandingPage.tsx` | Modify | NAV_LABELS, state, sidebar grup, tab render |

---

## Task 1: Prisma Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260520000000_add_negative_keywords/migration.sql`

- [ ] **Step 1: schema.prisma'ya modeli ekle**

`prisma/schema.prisma` sonuna ekle:

```prisma
model NegativeKeyword {
  id          String   @id @default(cuid())
  word        String   @unique
  createdById String
  createdAt   DateTime @default(now())
}
```

- [ ] **Step 2: Migration dizinini ve SQL dosyasını oluştur**

```bash
mkdir -p prisma/migrations/20260520000000_add_negative_keywords
```

`prisma/migrations/20260520000000_add_negative_keywords/migration.sql` içeriği:

```sql
CREATE TABLE "NegativeKeyword" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NegativeKeyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NegativeKeyword_word_key" ON "NegativeKeyword"("word");
```

- [ ] **Step 3: Prisma client'ı yeniden oluştur**

```bash
npx prisma generate
```

Expected output: `Generated Prisma Client` (hata yok)

- [ ] **Step 4: Migration'ı uygula**

```bash
npx prisma migrate deploy
```

Expected: `1 migration applied`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260520000000_add_negative_keywords/
git commit -m "feat: add NegativeKeyword prisma model and migration"
```

---

## Task 2: Keyword CRUD API

**Files:**
- Create: `app/api/negative-keywords/route.ts`
- Create: `app/api/negative-keywords/[id]/route.ts`

- [ ] **Step 1: GET + POST route oluştur**

`app/api/negative-keywords/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

function isAuthorized(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !isAuthorized(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const keywords = await prisma.negativeKeyword.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, word: true, createdAt: true },
  });

  return NextResponse.json({ keywords });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !isAuthorized(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { word } = await req.json().catch(() => ({ word: "" }));
  const normalized = typeof word === "string" ? word.trim().toLowerCase() : "";

  if (!normalized) {
    return NextResponse.json({ error: "Kelime boş olamaz." }, { status: 400 });
  }

  try {
    const keyword = await prisma.negativeKeyword.create({
      data: { word: normalized, createdById: user.id },
      select: { id: true, word: true, createdAt: true },
    });
    return NextResponse.json({ keyword }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Bu kelime zaten mevcut." }, { status: 409 });
    }
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
```

- [ ] **Step 2: DELETE route oluştur**

`app/api/negative-keywords/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.negativeKeyword.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Keyword bulunamadı." }, { status: 404 });
  }
}
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok (boş output)

- [ ] **Step 4: Commit**

```bash
git add app/api/negative-keywords/
git commit -m "feat: add negative-keywords CRUD API (GET, POST, DELETE)"
```

---

## Task 3: Rapor API

**Files:**
- Create: `app/api/reports/negative-keywords/route.ts`

- [ ] **Step 1: Route dosyasını oluştur**

`app/api/reports/negative-keywords/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

function extractSnippet(transcript: string, word: string): string {
  const lower = transcript.toLowerCase();
  const idx = lower.indexOf(word);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 80);
  const end = Math.min(transcript.length, idx + word.length + 80);
  return (start > 0 ? "…" : "") + transcript.slice(start, end) + (end < transcript.length ? "…" : "");
}

function countHits(transcript: string, word: string): number {
  const lower = transcript.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lower.indexOf(word, pos)) !== -1) {
    count++;
    pos += word.length;
  }
  return count;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const keywords = await prisma.negativeKeyword.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, word: true },
  });

  if (keywords.length === 0) {
    return NextResponse.json({
      results: [],
      totalEvaluationsScanned: 0,
      dateRange: { start: startDate, end: endDate },
    });
  }

  const dateFilter = startDate || endDate
    ? {
        callDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
        },
      }
    : {};

  const evaluations = await prisma.evaluation.findMany({
    where: dateFilter,
    select: {
      id: true,
      transcript: true,
      callDate: true,
      agent: { select: { name: true } },
    },
    orderBy: { callDate: "desc" },
  });

  const results = keywords.map((kw) => {
    const word = kw.word; // already lowercase from storage
    const matches: Array<{
      evaluationId: string;
      agentName: string;
      callDate: string;
      snippet: string;
    }> = [];
    let totalHits = 0;
    const agentSet = new Set<string>();

    for (const ev of evaluations) {
      const hits = countHits(ev.transcript, word);
      if (hits === 0) continue;
      totalHits += hits;
      const agentName = ev.agent?.name ?? "Bilinmiyor";
      agentSet.add(agentName);
      matches.push({
        evaluationId: ev.id,
        agentName,
        callDate: ev.callDate.toISOString(),
        snippet: extractSnippet(ev.transcript, word),
      });
    }

    return {
      keywordId: kw.id,
      word: kw.word,
      callCount: matches.length,
      totalHits,
      agentNames: Array.from(agentSet),
      matches,
    };
  });

  return NextResponse.json({
    results,
    totalEvaluationsScanned: evaluations.length,
    dateRange: { start: startDate, end: endDate },
  });
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/negative-keywords/
git commit -m "feat: add negative-keywords report API (server-side transcript scan)"
```

---

## Task 4: NegativeKeywordsReport Component

**Files:**
- Create: `app/components/shared/NegativeKeywordsReport.tsx`

- [ ] **Step 1: Component dosyasını oluştur**

`app/components/shared/NegativeKeywordsReport.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import DateRangePicker from "@/app/components/shared/DateRangePicker";

interface Keyword {
  id: string;
  word: string;
  createdAt: string;
}

interface Match {
  evaluationId: string;
  agentName: string;
  callDate: string;
  snippet: string;
}

interface KeywordResult {
  keywordId: string;
  word: string;
  callCount: number;
  totalHits: number;
  agentNames: string[];
  matches: Match[];
}

interface ReportData {
  results: KeywordResult[];
  totalEvaluationsScanned: number;
  dateRange: { start: string | null; end: string | null };
}

const L = {
  tr: {
    title: "Negatif Kelime Raporu",
    subtitle: "Çağrı transkriptlerinde negatif kelime kullanımını izle",
    kwSection: "Keyword Yönetimi",
    kwEmpty: "Henüz keyword eklenmedi.",
    kwPlaceholder: "Yeni keyword...",
    kwAdd: "Ekle",
    kwDuplicate: "Bu kelime zaten mevcut.",
    kwError: "Eklenemedi.",
    filterSection: "Tarih Aralığı",
    runReport: "Raporu Çalıştır",
    running: "Taranıyor...",
    noKeywords: "Rapor çalıştırmak için en az bir keyword ekleyin.",
    resultsSection: "Sonuçlar",
    scanned: (n: number) => `${n} çağrı tarandı`,
    colKeyword: "Keyword",
    colCalls: "Çağrı",
    colHits: "Geçiş",
    colAgents: "Danışmanlar",
    noMatches: "Seçilen tarih aralığında eşleşme bulunamadı.",
    noResults: "Hiçbir keyword eşleşmedi.",
    agent: "Danışman",
    date: "Tarih",
    snippet: "Alıntı",
    goToEval: "Değerlendirmeye git →",
  },
  en: {
    title: "Negative Keyword Report",
    subtitle: "Track negative keyword usage across call transcripts",
    kwSection: "Keyword Management",
    kwEmpty: "No keywords added yet.",
    kwPlaceholder: "New keyword...",
    kwAdd: "Add",
    kwDuplicate: "This keyword already exists.",
    kwError: "Could not add.",
    filterSection: "Date Range",
    runReport: "Run Report",
    running: "Scanning...",
    noKeywords: "Add at least one keyword to run the report.",
    resultsSection: "Results",
    scanned: (n: number) => `${n} calls scanned`,
    colKeyword: "Keyword",
    colCalls: "Calls",
    colHits: "Hits",
    colAgents: "Agents",
    noMatches: "No matches found in the selected date range.",
    noResults: "No keyword matched.",
    agent: "Agent",
    date: "Date",
    snippet: "Excerpt",
    goToEval: "Go to evaluation →",
  },
};

function highlightWord(text: string, word: string): React.ReactNode {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(word.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(239,68,68,.25)", color: "inherit", borderRadius: 2, padding: "0 2px" }}>
        {text.slice(idx, idx + word.length)}
      </mark>
      {text.slice(idx + word.length)}
    </>
  );
}

export default function NegativeKeywordsReport({ lang }: { lang: "tr" | "en" }) {
  const t = L[lang];

  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [newWord, setNewWord] = useState("");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [expandedKeyword, setExpandedKeyword] = useState<string | null>(null);

  useEffect(() => { fetchKeywords(); }, []);

  const fetchKeywords = async () => {
    const res = await fetch("/api/negative-keywords");
    if (res.ok) {
      const d = await res.json();
      setKeywords(d.keywords || []);
    }
  };

  const addKeyword = async () => {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    setAddLoading(true);
    setAddError("");
    const res = await fetch("/api/negative-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word }),
    });
    if (res.ok) {
      const d = await res.json();
      setKeywords(prev => [...prev, d.keyword]);
      setNewWord("");
    } else {
      const d = await res.json().catch(() => ({}));
      setAddError(d.error === "Bu kelime zaten mevcut." ? t.kwDuplicate : t.kwError);
    }
    setAddLoading(false);
  };

  const deleteKeyword = async (id: string) => {
    const res = await fetch(`/api/negative-keywords/${id}`, { method: "DELETE" });
    if (res.ok) setKeywords(prev => prev.filter(k => k.id !== id));
  };

  const runReport = async () => {
    setReportLoading(true);
    setReportData(null);
    setExpandedKeyword(null);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const res = await fetch(`/api/reports/negative-keywords?${params}`);
    if (res.ok) {
      setReportData(await res.json());
    }
    setReportLoading(false);
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  };

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: 0 }}>{t.title}</h1>
        <p style={{ fontSize: 13, color: "var(--fg-faint)", marginTop: 4 }}>{t.subtitle}</p>
      </div>

      {/* Section 1: Keyword Management */}
      <div style={cardStyle}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
          {t.kwSection}
        </p>

        {/* Chip list */}
        {keywords.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--fg-faint)", marginBottom: 14 }}>{t.kwEmpty}</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {keywords.map(kw => (
              <span
                key={kw.id}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)",
                  borderRadius: 20, padding: "4px 10px 4px 12px",
                  fontSize: 12, fontWeight: 600, color: "#f87171",
                }}
              >
                {kw.word}
                <button
                  onClick={() => deleteKeyword(kw.id)}
                  style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 0, lineHeight: 1, fontSize: 14 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Add input */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={newWord}
            onChange={e => { setNewWord(e.target.value); setAddError(""); }}
            onKeyDown={e => e.key === "Enter" && addKeyword()}
            placeholder={t.kwPlaceholder}
            style={{
              flex: 1, background: "var(--glass-bg)", border: "1px solid var(--glass-border)",
              borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "var(--fg)",
              outline: "none",
            }}
          />
          <button
            onClick={addKeyword}
            disabled={addLoading || !newWord.trim()}
            style={{
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", opacity: (addLoading || !newWord.trim()) ? 0.5 : 1,
            }}
          >
            {t.kwAdd}
          </button>
        </div>
        {addError && <p style={{ fontSize: 12, color: "#f87171", marginTop: 6 }}>{addError}</p>}
      </div>

      {/* Section 2: Date Filter */}
      <div style={{ marginBottom: 16 }}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onApply={runReport}
          lang={lang}
        />
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={runReport}
            disabled={reportLoading || keywords.length === 0}
            style={{
              background: "linear-gradient(to right, var(--accent), #8b5cf6)",
              color: "#fff", border: "none", borderRadius: 10,
              padding: "9px 22px", fontSize: 13, fontWeight: 700,
              cursor: "pointer", opacity: (reportLoading || keywords.length === 0) ? 0.5 : 1,
            }}
          >
            {reportLoading ? t.running : t.runReport}
          </button>
          {keywords.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>{t.noKeywords}</span>
          )}
        </div>
      </div>

      {/* Section 3: Results */}
      {reportData && (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              {t.resultsSection}
            </p>
            <span style={{ fontSize: 12, color: "var(--fg-faint)" }}>{t.scanned(reportData.totalEvaluationsScanned)}</span>
          </div>

          {reportData.results.length === 0 || reportData.results.every(r => r.callCount === 0) ? (
            <p style={{ fontSize: 13, color: "var(--fg-faint)" }}>{t.noResults}</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    {[t.colKeyword, t.colCalls, t.colHits, t.colAgents].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", fontSize: 11, fontWeight: 700, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.results.map(r => (
                    <>
                      <tr
                        key={r.keywordId}
                        onClick={() => setExpandedKeyword(expandedKeyword === r.keywordId ? null : r.keywordId)}
                        style={{ cursor: r.callCount > 0 ? "pointer" : "default", borderBottom: "1px solid var(--glass-border)", transition: "background 0.1s" }}
                        onMouseEnter={e => r.callCount > 0 && ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.03)")}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "")}
                      >
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ color: r.callCount > 0 ? "#f87171" : "var(--fg-faint)", fontWeight: 600 }}>{r.word}</span>
                            {r.callCount > 0 && (
                              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                                {expandedKeyword === r.keywordId ? "▲" : "▼"}
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: "10px 10px", color: r.callCount > 0 ? "var(--fg)" : "var(--fg-faint)", fontWeight: r.callCount > 0 ? 700 : 400 }}>
                          {r.callCount}
                        </td>
                        <td style={{ padding: "10px 10px", color: r.totalHits > 0 ? "#fb923c" : "var(--fg-faint)" }}>
                          {r.totalHits}
                        </td>
                        <td style={{ padding: "10px 10px", color: "var(--fg-dim)", fontSize: 12 }}>
                          {r.agentNames.join(", ") || "—"}
                        </td>
                      </tr>

                      {/* Expanded matches */}
                      {expandedKeyword === r.keywordId && r.matches.length > 0 && (
                        <tr key={`${r.keywordId}-expand`}>
                          <td colSpan={4} style={{ padding: "0 10px 10px 10px", background: "rgba(239,68,68,.04)" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginTop: 4 }}>
                              <thead>
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--fg-faint)", fontWeight: 600 }}>{t.agent}</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--fg-faint)", fontWeight: 600 }}>{t.date}</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--fg-faint)", fontWeight: 600 }}>{t.snippet}</th>
                                  <th style={{ padding: "4px 8px" }} />
                                </tr>
                              </thead>
                              <tbody>
                                {r.matches.map((m, i) => (
                                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                    <td style={{ padding: "6px 8px", color: "var(--fg)", whiteSpace: "nowrap" }}>{m.agentName}</td>
                                    <td style={{ padding: "6px 8px", color: "var(--fg-dim)", whiteSpace: "nowrap" }}>
                                      {new Date(m.callDate).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB")}
                                    </td>
                                    <td style={{ padding: "6px 8px", color: "var(--fg-dim)", fontStyle: "italic", lineHeight: 1.5 }}>
                                      {highlightWord(m.snippet, r.word)}
                                    </td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                      <a href={`/evaluation/${m.evaluationId}`} style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none" }}>
                                        {t.goToEval}
                                      </a>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/NegativeKeywordsReport.tsx
git commit -m "feat: add NegativeKeywordsReport component"
```

---

## Task 5: LandingPage Entegrasyonu

**Files:**
- Modify: `app/components/LandingPage.tsx`

Bu task 4 değişiklik içerir; sırayla uygula.

### 5a: Import ve NAV_LABELS

- [ ] **Step 1: Import ekle (satır 12'den sonra)**

Mevcut importların sonuna:
```tsx
import NegativeKeywordsReport from "@/app/components/shared/NegativeKeywordsReport";
```

- [ ] **Step 2: NAV_LABELS'a `negKeywords` ekle**

`tr` nesnesine (satır 36 civarı, `recentCalls` satırına birlikte):
```
negKeywords: "Negatif Kelimeler",
```

`en` nesnesine (satır 45 civarı):
```
negKeywords: "Negative Keywords",
```

Sonuç:
```tsx
tr: {
  home: "Ana Sayfa", evaluations: "Değerlendirmeler", scores: "Skorlarım",
  reports: "Raporlarım", teamreports: "Raporlar", team: "Takımım",
  feedback: "Geri Bildirim", status: "Çağrı Durumu",
  batch: "Toplu Analiz", admin: "Ayarlar", peer: "Nasıl Gidiyorum?",
  feedbacks: "Geri Bildirimler", sync: "Senkronizasyon",
  recentCalls: "Son Çağrılar", negKeywords: "Negatif Kelimeler",
},
en: {
  home: "Home", evaluations: "Evaluations", scores: "My Scores",
  reports: "My Reports", teamreports: "Reports", team: "My Team",
  feedback: "Feedback", status: "Calls Status",
  batch: "Bulk Analysis", admin: "Settings", peer: "How Am I Doing?",
  feedbacks: "Feedbacks", sync: "Synchronization",
  recentCalls: "Recent Calls", negKeywords: "Negative Keywords",
},
```

### 5b: `reportsOpen` state ekle

- [ ] **Step 3: State'i ekle**

`/* batch (admin) */` state bloğunun hemen altına (satır 241 civarı):

```tsx
/* reports sidebar group */
const [reportsOpen, setReportsOpen] = useState(
  () => activeTab === "reports" || activeTab === "negKeywords"
);
```

### 5c: Sidebar'da genişleyebilir grup

- [ ] **Step 4: Sidebar nav map'ini güncelle**

Mevcut `{mainNavItems.map(({ key, icon }) => (` bloğunu şununla değiştir:

```tsx
<nav className={styles.sbNav}>
  {mainNavItems.map(({ key, icon }) => {
    if (key === "reports" && isManagerLike) {
      return (
        <div key="reports-group">
          <button
            onClick={() => setReportsOpen(v => !v)}
            className={`${styles.sbLink} ${(activeTab === "reports" || activeTab === "negKeywords") ? styles.sbLinkActive : ""}`}
            style={{ justifyContent: "space-between" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="doc" size={15} />
              <span>{lang === "tr" ? "Raporlar" : "Reports"}</span>
            </span>
            <span style={{ fontSize: 10, transition: "transform 0.2s", display: "inline-block", transform: reportsOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
          </button>
          <div style={{ overflow: "hidden", maxHeight: reportsOpen ? 80 : 0, transition: "max-height 0.2s ease" }}>
            <button
              onClick={() => handleTab("reports")}
              className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "reports" ? styles.sbLinkActive : ""}`}
              style={{ paddingLeft: 32 }}
            >
              <span>{navLabels.reports}</span>
            </button>
            <button
              onClick={() => handleTab("negKeywords")}
              className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "negKeywords" ? styles.sbLinkActive : ""}`}
              style={{ paddingLeft: 32 }}
            >
              <span>{navLabels.negKeywords}</span>
            </button>
          </div>
        </div>
      );
    }
    return (
      <button
        key={key}
        onClick={() => handleTab(key)}
        className={`${styles.sbLink} ${activeTab === key ? styles.sbLinkActive : ""}`}
      >
        <Icon name={icon} size={15} />
        <span>{navLabels[key]}</span>
      </button>
    );
  })}
</nav>
```

- [ ] **Step 5: `handleTab`'a `reportsOpen` tetikle**

`handleTab` fonksiyonunu bul (satır 313 civarı). İçinde `setActiveTab(tab)` satırından sonra ekle:

```tsx
if (tab === "reports" || tab === "negKeywords") setReportsOpen(true);
```

### 5d: Tab içeriği ekle

- [ ] **Step 6: `negKeywords` tab render bloğunu ekle**

`{activeTab === "feedbacks" && user.role === "ADMIN" && (` bloğunun hemen önüne ekle:

```tsx
{activeTab === "negKeywords" && (user.role === "ADMIN" || user.role === "MANAGER") && (
  <div className={styles.page}>
    <NegativeKeywordsReport lang={lang} />
  </div>
)}
```

- [ ] **Step 7: TypeScript kontrolü**

```bash
npx tsc --noEmit
```

Expected: Hata yok

- [ ] **Step 8: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: wire NegativeKeywordsReport into sidebar and LandingPage"
```

---

## Task 6: Manuel Test

- [ ] **Step 1: Dev server'ı başlat**

```bash
npm run dev
```

- [ ] **Step 2: ADMIN ile giriş yap, test senaryolarını çalıştır**

  - Sidebar'da "Raporlar" başlığına tıkla → alt seçenekler kayarak açılmalı
  - "Negatif Kelimeler" → `NegativeKeywordsReport` ekranı gelir
  - Keyword ekle: "aptal" → chip görünür
  - Aynı keyword'ü tekrar ekle → "Bu kelime zaten mevcut." hatası
  - Keyword sil → chip kalkar
  - "Raporu Çalıştır" → sonuç tablosu gelir
  - Eşleşen keyword satırına tıkla → alt tablo açılır, snippet highlight'lı görünür
  - "Değerlendirmeye git →" linki doğru URL'ye gider

- [ ] **Step 3: MANAGER ile giriş yap**

  - Aynı akış MANAGER için de çalışır
  - Keyword ekleyip silebilir
  - Rapor çalıştırabilir

- [ ] **Step 4: AGENT ile giriş yap**

  - Sidebar'da "Negatif Kelimeler" görünmez
  - `/api/negative-keywords` GET → 403
  - `/api/reports/negative-keywords` GET → 403

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: negative keywords report — complete implementation"
```
