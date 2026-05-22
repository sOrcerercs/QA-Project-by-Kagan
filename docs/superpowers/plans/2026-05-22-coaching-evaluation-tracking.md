# Coaching & Evaluation Tracking Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "Coaching & Evaluation Tracking" dashboard under the Reports sidebar group, visible only to Admin and Manager, showing which agents have read their evaluations and which team leaders have completed coaching sessions, with date range filtering.

**Architecture:** New `GET /api/reports/coaching-tracking` endpoint fetches evaluations (excluding heavy transcript/report fields), groups them by agent in the application layer, and returns summary + per-agent accordion data. A new `CoachingTrackingView` component renders 3 summary cards and an accordion table. Wired into `LandingPage` as a new tab under the existing Reports sidebar group.

**Tech Stack:** Next.js 14 App Router, Prisma (PostgreSQL), React, TypeScript, existing CSS modules and design tokens (`var(--glass-bg)`, `var(--accent)`, etc.)

---

## File Map

| File | Action |
|------|--------|
| `app/lib/i18n.ts` | Modify — add translation keys for TR and EN |
| `app/api/reports/coaching-tracking/route.ts` | Create — GET endpoint |
| `app/components/shared/CoachingTrackingView.tsx` | Create — dashboard component |
| `app/components/LandingPage.tsx` | Modify — nav item, tab state, tab render |

---

## Task 1: Add i18n translations

**Files:**
- Modify: `app/lib/i18n.ts`

- [ ] **Step 1: Add TR translations**

In `app/lib/i18n.ts`, locate the closing of the `tr` block (just before `noEvaluationsLast7Days`). Add the following block before the `noEvaluationsLast7Days` line in `tr`:

```ts
    // Coaching Tracking
    nav_coachingTracking: "Coaching Takibi",
    coachingTrackingTitle: "Coaching & Değerlendirme Takibi",
    coachingTrackingSub: "Değerlendirme okunma ve coaching tamamlanma takibi",
    ctTotalEvals: "Toplam Değerlendirme",
    ctAgentRead: "Okunan",
    ctCoachingDone: "Coaching Yapılan",
    ctReadLabel: "Okundu",
    ctNotReadLabel: "Okunmadı",
    ctCoachingDoneLabel: "Yapıldı",
    ctCoachingNotDoneLabel: "Yapılmadı",
    ctNoEvals: "Bu tarih aralığında değerlendirme bulunamadı.",
    ctCustomer: "Müşteri",
    ctDate: "Tarih",
    ctScore: "Skor",
    ctRead: "Okundu",
    ctCoaching: "Coaching",
    ctEvals: "değerlendirme",
    ctTeam: "Takım",
    ctNoTeam: "Takımsız",
```

- [ ] **Step 2: Add EN translations**

In `app/lib/i18n.ts`, locate the closing of the `en` block (just before `noEvaluationsLast7Days` in the `en` section). Add the following block:

```ts
    // Coaching Tracking
    nav_coachingTracking: "Coaching Tracking",
    coachingTrackingTitle: "Coaching & Evaluation Tracking",
    coachingTrackingSub: "Track evaluation reads and coaching completion",
    ctTotalEvals: "Total Evaluations",
    ctAgentRead: "Read",
    ctCoachingDone: "Coaching Done",
    ctReadLabel: "Read",
    ctNotReadLabel: "Not Read",
    ctCoachingDoneLabel: "Done",
    ctCoachingNotDoneLabel: "Not Done",
    ctNoEvals: "No evaluations found in this date range.",
    ctCustomer: "Customer",
    ctDate: "Date",
    ctScore: "Score",
    ctRead: "Read",
    ctCoaching: "Coaching",
    ctEvals: "evaluations",
    ctTeam: "Team",
    ctNoTeam: "No Team",
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/i18n.ts
git commit -m "feat: add i18n keys for coaching tracking dashboard"
```

---

## Task 2: Create the API endpoint

**Files:**
- Create: `app/api/reports/coaching-tracking/route.ts`

- [ ] **Step 1: Create the directory and file**

Create `app/api/reports/coaching-tracking/route.ts` with this content:

```ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");

  const dateFilter = startDate || endDate
    ? {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
        },
      }
    : {};

  const rows = await prisma.evaluation.findMany({
    where: { ...dateFilter, unassigned: false },
    select: {
      id: true,
      customerName: true,
      callDate: true,
      score: true,
      agentRead: true,
      agentReadAt: true,
      coachingDone: true,
      coachingDoneAt: true,
      coachingNotes: true,
      coachingByName: true,
      agentId: true,
      agent: {
        select: {
          name: true,
          team: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by agentId
  const agentMap = new Map<string, {
    agentId: string;
    agentName: string;
    teamName: string | null;
    evaluations: typeof rows;
  }>();

  for (const row of rows) {
    if (!agentMap.has(row.agentId)) {
      agentMap.set(row.agentId, {
        agentId: row.agentId,
        agentName: row.agent.name,
        teamName: row.agent.team?.name ?? null,
        evaluations: [],
      });
    }
    agentMap.get(row.agentId)!.evaluations.push(row);
  }

  const agents = Array.from(agentMap.values()).map((a) => ({
    agentId: a.agentId,
    agentName: a.agentName,
    teamName: a.teamName,
    totalEvals: a.evaluations.length,
    readCount: a.evaluations.filter((e) => e.agentRead).length,
    coachingDoneCount: a.evaluations.filter((e) => e.coachingDone).length,
    evaluations: a.evaluations.map((e) => ({
      id: e.id,
      customerName: e.customerName,
      callDate: e.callDate.toISOString(),
      score: e.score,
      agentRead: e.agentRead,
      agentReadAt: e.agentReadAt?.toISOString() ?? null,
      coachingDone: e.coachingDone,
      coachingDoneAt: e.coachingDoneAt?.toISOString() ?? null,
      coachingNotes: e.coachingNotes ?? null,
      coachingByName: e.coachingByName ?? null,
    })),
  }));

  const totalEvaluations = rows.length;
  const agentReadCount = rows.filter((r) => r.agentRead).length;
  const coachingDoneCount = rows.filter((r) => r.coachingDone).length;

  return NextResponse.json({
    summary: { totalEvaluations, agentReadCount, coachingDoneCount },
    agents,
  });
}
```

- [ ] **Step 2: Verify the endpoint returns 403 for non-admin**

Start the dev server if not running: `npm run dev`

Then in a separate terminal, test with a non-admin cookie (or check the auth guard logic is correct by reading `getUserFromToken` in `app/lib/auth.ts` to confirm role is returned).

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/coaching-tracking/route.ts
git commit -m "feat: add GET /api/reports/coaching-tracking endpoint"
```

---

## Task 3: Create CoachingTrackingView component

**Files:**
- Create: `app/components/shared/CoachingTrackingView.tsx`

- [ ] **Step 1: Create the component**

Create `app/components/shared/CoachingTrackingView.tsx`:

```tsx
"use client";

import { useState, useCallback } from "react";
import DateRangePicker from "@/app/components/shared/DateRangePicker";
import { translations } from "@/app/lib/i18n";

interface EvalRow {
  id: string;
  customerName: string;
  callDate: string;
  score: number;
  agentRead: boolean;
  agentReadAt: string | null;
  coachingDone: boolean;
  coachingDoneAt: string | null;
  coachingNotes: string | null;
  coachingByName: string | null;
}

interface AgentRow {
  agentId: string;
  agentName: string;
  teamName: string | null;
  totalEvals: number;
  readCount: number;
  coachingDoneCount: number;
  evaluations: EvalRow[];
}

interface Summary {
  totalEvaluations: number;
  agentReadCount: number;
  coachingDoneCount: number;
}

interface CoachingTrackingViewProps {
  lang?: "tr" | "en";
}

function PercentBar({ value, total }: { value: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 99, background: "var(--rule)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "var(--accent)",
            borderRadius: 99,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span style={{ fontSize: 10, color: "var(--fg-dim)", marginTop: 3, display: "block" }}>
        {value} / {total} ({pct}%)
      </span>
    </div>
  );
}

function SummaryCard({ label, value, total }: { label: string; value: number; total?: number }) {
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 16,
        padding: "16px 20px",
        background: "var(--glass-bg)",
        border: "1px solid var(--rule)",
      }}
    >
      <p style={{ fontSize: 11, color: "var(--fg-dim)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </p>
      <p style={{ fontSize: 28, fontWeight: 700, color: "var(--fg)", marginTop: 4 }}>{value}</p>
      {total !== undefined && <PercentBar value={value} total={total} />}
    </div>
  );
}

function StatusBadge({ done, doneLabel, notDoneLabel }: { done: boolean; doneLabel: string; notDoneLabel: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 99,
        background: done ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.1)",
        color: done ? "#22c55e" : "#ef4444",
        border: `1px solid ${done ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.2)"}`,
        whiteSpace: "nowrap" as const,
      }}
    >
      {done ? "✓" : "✗"} {done ? doneLabel : notDoneLabel}
    </span>
  );
}

export default function CoachingTrackingView({ lang = "tr" }: CoachingTrackingViewProps) {
  const t = translations[lang];
  const [summary, setSummary] = useState<Summary | null>(null);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [fetched, setFetched] = useState(false);

  const fetchData = useCallback(async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set("startDate", start);
      if (end) params.set("endDate", end);
      const res = await fetch(`/api/reports/coaching-tracking${params.toString() ? `?${params}` : ""}`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setAgents(data.agents);
        setFetched(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleAgent = (agentId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  const notePreview = (notes: string | null) => {
    if (!notes) return null;
    return notes.length > 40 ? notes.slice(0, 40) + "…" : notes;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)" }}>{t.coachingTrackingTitle}</h1>
        <p style={{ fontSize: 13, color: "var(--fg-dim)", marginTop: 4 }}>{t.coachingTrackingSub}</p>
      </div>

      {/* Date range picker */}
      <div style={{ borderRadius: 20, padding: "20px 24px", marginBottom: 20, background: "var(--glass-bg)", border: "1px solid var(--rule)" }}>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
          onApply={() => fetchData(startDate || undefined, endDate || undefined)}
          lang={lang}
        />
      </div>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <SummaryCard label={t.ctTotalEvals} value={summary.totalEvaluations} />
          <SummaryCard label={t.ctAgentRead} value={summary.agentReadCount} total={summary.totalEvaluations} />
          <SummaryCard label={t.ctCoachingDone} value={summary.coachingDoneCount} total={summary.totalEvaluations} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: "64px 0", textAlign: "center" }}>
          <div style={{ width: 20, height: 20, border: "2px solid var(--rule)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
        </div>
      )}

      {/* Empty state */}
      {!loading && fetched && agents.length === 0 && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-dim)", fontSize: 14 }}>
          {t.ctNoEvals}
        </div>
      )}

      {/* Prompt to apply filter */}
      {!loading && !fetched && (
        <div style={{ padding: "48px 0", textAlign: "center", color: "var(--fg-dim)", fontSize: 14 }}>
          {lang === "tr" ? "Tarih aralığı seçip 'Uygula'ya basın." : "Select a date range and press 'Apply'."}
        </div>
      )}

      {/* Accordion table */}
      {!loading && agents.length > 0 && (
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--rule)" }}>
          {/* Table header */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 80px 90px 100px",
              padding: "10px 16px",
              background: "var(--glass-bg)",
              borderBottom: "1px solid var(--rule)",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--fg-dim)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            <span>{lang === "tr" ? "Danışman" : "Consultant"}</span>
            <span>{t.ctTeam}</span>
            <span style={{ textAlign: "center" }}>{lang === "tr" ? "Değ." : "Evals"}</span>
            <span style={{ textAlign: "center" }}>{t.ctRead}</span>
            <span style={{ textAlign: "center" }}>{t.ctCoaching}</span>
          </div>

          {agents.map((agent, idx) => {
            const isExpanded = expandedIds.has(agent.agentId);
            const isLast = idx === agents.length - 1;
            return (
              <div key={agent.agentId} style={{ borderBottom: isLast ? "none" : "1px solid var(--rule)" }}>
                {/* Agent row */}
                <button
                  onClick={() => toggleAgent(agent.agentId)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 80px 90px 100px",
                    padding: "12px 16px",
                    background: isExpanded ? "rgba(59,130,246,.06)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 120ms",
                    alignItems: "center",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                    <span style={{ fontSize: 9, color: "var(--fg-faint)", display: "inline-block", transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                    {agent.agentName}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>{agent.teamName ?? t.ctNoTeam}</span>
                  <span style={{ fontSize: 12, color: "var(--fg-dim)", textAlign: "center" }}>{agent.totalEvals}</span>
                  <span style={{ fontSize: 12, textAlign: "center" }}>
                    <span style={{ color: agent.readCount === agent.totalEvals ? "#22c55e" : "var(--fg-dim)" }}>
                      {agent.readCount}/{agent.totalEvals}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, textAlign: "center" }}>
                    <span style={{ color: agent.coachingDoneCount === agent.totalEvals ? "#22c55e" : "var(--fg-dim)" }}>
                      {agent.coachingDoneCount}/{agent.totalEvals}
                    </span>
                  </span>
                </button>

                {/* Expanded eval rows */}
                {isExpanded && (
                  <div style={{ background: "rgba(0,0,0,.12)" }}>
                    {/* Sub-header */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 60px 1fr 2fr",
                        padding: "6px 32px",
                        fontSize: 9,
                        fontWeight: 700,
                        color: "var(--fg-faint)",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        borderBottom: "1px solid var(--rule)",
                      }}
                    >
                      <span>{t.ctCustomer}</span>
                      <span>{t.ctDate}</span>
                      <span>{t.ctScore}</span>
                      <span>{t.ctRead}</span>
                      <span>{t.ctCoaching}</span>
                    </div>

                    {agent.evaluations.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "2fr 1fr 60px 1fr 2fr",
                          padding: "8px 32px",
                          fontSize: 12,
                          color: "var(--fg)",
                          borderBottom: "1px solid var(--rule)",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ color: "var(--fg-dim)" }}>{ev.customerName}</span>
                        <span style={{ color: "var(--fg-dim)" }}>{fmtDate(ev.callDate)}</span>
                        <span
                          style={{
                            fontWeight: 700,
                            color: ev.score >= 75 ? "#22c55e" : ev.score >= 50 ? "#f59e0b" : "#ef4444",
                          }}
                        >
                          {ev.score}
                        </span>

                        {/* Read status */}
                        <div>
                          <StatusBadge done={ev.agentRead} doneLabel={t.ctReadLabel} notDoneLabel={t.ctNotReadLabel} />
                          {ev.agentRead && ev.agentReadAt && (
                            <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
                              {fmtDate(ev.agentReadAt)}
                            </div>
                          )}
                        </div>

                        {/* Coaching status */}
                        <div>
                          <StatusBadge done={ev.coachingDone} doneLabel={t.ctCoachingDoneLabel} notDoneLabel={t.ctCoachingNotDoneLabel} />
                          {ev.coachingDone && ev.coachingDoneAt && (
                            <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2 }}>
                              {fmtDate(ev.coachingDoneAt)}
                              {ev.coachingByName && ` · ${ev.coachingByName}`}
                            </div>
                          )}
                          {ev.coachingDone && ev.coachingNotes && (
                            <div
                              title={ev.coachingNotes}
                              style={{
                                fontSize: 10,
                                color: "var(--fg-dim)",
                                marginTop: 2,
                                cursor: "help",
                                fontStyle: "italic",
                              }}
                            >
                              "{notePreview(ev.coachingNotes)}"
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `CoachingTrackingView.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/CoachingTrackingView.tsx
git commit -m "feat: add CoachingTrackingView component"
```

---

## Task 4: Wire up in LandingPage

**Files:**
- Modify: `app/components/LandingPage.tsx`

- [ ] **Step 1: Add import**

At the top of `app/components/LandingPage.tsx`, add the import alongside other shared components:

```ts
import CoachingTrackingView from "@/app/components/shared/CoachingTrackingView";
```

- [ ] **Step 2: Add nav label**

In the `NAV_LABELS` constant (around line 32), add `coachingTracking` to both `tr` and `en`:

```ts
// In tr:
coachingTracking: "Coaching Takibi",

// In en:
coachingTracking: "Coaching Tracking",
```

- [ ] **Step 3: Update Reports parent button active state**

Find the Reports parent button in the sidebar nav (around line 831):

```tsx
className={`${styles.sbLink} ${(activeTab === "reports" || activeTab === "negKeywords") ? styles.sbLinkActive : ""}`}
```

Replace with:

```tsx
className={`${styles.sbLink} ${(activeTab === "reports" || activeTab === "negKeywords" || activeTab === "coachingTracking") ? styles.sbLinkActive : ""}`}
```

- [ ] **Step 4: Add coachingTracking to reportsOpen state**

Find the `reportsOpen` useState initializer (around line 263):

```ts
const [reportsOpen, setReportsOpen] = useState(
  () => activeTab === "reports" || activeTab === "negKeywords"
);
```

Replace with:

```ts
const [reportsOpen, setReportsOpen] = useState(
  () => activeTab === "reports" || activeTab === "negKeywords" || activeTab === "coachingTracking"
);
```

- [ ] **Step 5: Update popstate handler**

Find the `onPopState` handler (around line 331):

```ts
if (tab === "reports" || tab === "negKeywords") setReportsOpen(true);
```

Replace with:

```ts
if (tab === "reports" || tab === "negKeywords" || tab === "coachingTracking") setReportsOpen(true);
```

- [ ] **Step 6: Update handleTab**

Find the other `setReportsOpen(true)` call inside `handleTab` (around line 347):

```ts
if (tab === "reports" || tab === "negKeywords") setReportsOpen(true);
```

Replace with:

```ts
if (tab === "reports" || tab === "negKeywords" || tab === "coachingTracking") setReportsOpen(true);
```

- [ ] **Step 7: Add coachingTracking sub-item to Reports sidebar group**

Find the Reports accordion in the nav (around line 840). The current accordion div has `maxHeight: reportsOpen ? 80 : 0`. Replace the entire `<div style={{ overflow: "hidden", maxHeight: ...` block with:

```tsx
<div style={{ overflow: "hidden", maxHeight: reportsOpen ? 120 : 0, transition: "max-height 0.2s ease" }}>
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
  <button
    onClick={() => handleTab("coachingTracking")}
    className={`${styles.sbLink} ${styles.sbLinkSm} ${activeTab === "coachingTracking" ? styles.sbLinkActive : ""}`}
    style={{ paddingLeft: 32 }}
  >
    <span>{navLabels.coachingTracking}</span>
  </button>
</div>
```

- [ ] **Step 8: Add tab render**

Find the `negKeywords` tab render block (around line 2141):

```tsx
{activeTab === "negKeywords" && (user.role === "ADMIN" || user.role === "MANAGER") && (
  <div className={styles.page}>
    <NegativeKeywordsReport lang={lang} />
  </div>
)}
```

Add immediately after it:

```tsx
{activeTab === "coachingTracking" && isManagerLike && (
  <div className={styles.page}>
    <CoachingTrackingView lang={lang} />
  </div>
)}
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 10: Manual smoke test**

1. Start dev server: `npm run dev`
2. Log in as Admin or Manager
3. Open the sidebar → **Raporlar** group → verify **"Coaching Takibi"** sub-item is visible
4. Click **"Coaching Takibi"** → page loads with title and date picker
5. Click **Uygula** without dates → summary cards appear, accordion list loads
6. Expand an agent row → evaluation sub-rows appear with read/coaching status badges
7. Hover over a coaching note preview → full note appears in browser tooltip
8. Log in as Team Leader → verify "Coaching Takibi" is NOT in the sidebar

- [ ] **Step 11: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: wire CoachingTrackingView into Reports sidebar group"
```
