# Consultant Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add role-based dashboards so AGENT sees only their own data, TEAM_LEADER sees their team data with filtering, and ADMIN/MANAGER see the existing full view.

**Architecture:** `page.tsx` becomes a thin router that renders `<AgentDashboard>`, `<TeamLeaderDashboard>`, or `<AdminDashboard>` based on the logged-in user's role. Shared UI blocks (KPI cards, evaluation list, score view) are extracted as reusable components. One new API endpoint (`GET /api/team/members`) is added; two existing endpoints (`/api/evaluations`, `/api/scores`) get optional date/agentIds query params for team leader filtering.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Prisma, PostgreSQL, TailwindCSS, Framer Motion, Lucide React, `jose` JWT

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `app/page.tsx` | Thin router — renders dashboard by role |
| Create | `app/components/dashboards/AdminDashboard.tsx` | Full existing page.tsx content (ADMIN+MANAGER) |
| Create | `app/components/dashboards/AgentDashboard.tsx` | Agent's own KPI/calls/scores/reports |
| Create | `app/components/dashboards/TeamLeaderDashboard.tsx` | Agent view + "Takımım" tab |
| Create | `app/components/shared/KPISummary.tsx` | 3-card KPI row |
| Create | `app/components/shared/EvaluationList.tsx` | Filterable evaluation list |
| Create | `app/components/shared/ScoreView.tsx` | Score stats + weekly progress + recent calls |
| Create | `app/components/shared/ReportsView.tsx` | Weekly report + auto report panel |
| Create | `app/components/shared/TeamMemberPicker.tsx` | Checkbox multi-select of team members |
| Create | `app/components/shared/DateRangePicker.tsx` | Start/end date inputs |
| Modify | `app/api/evaluations/route.ts` | Add `agentIds`, `startDate`, `endDate` query params |
| Modify | `app/api/scores/route.ts` | Add `startDate`, `endDate` query params |
| Create | `app/api/team/members/route.ts` | `GET` — returns team members for TEAM_LEADER |

---

## Task 1: Create `GET /api/team/members` endpoint

**Files:**
- Create: `app/api/team/members/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/team/members/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!["TEAM_LEADER", "ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const teamId = user.role === "TEAM_LEADER" ? user.teamId : req.nextUrl.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ members: [] });

  const members = await prisma.user.findMany({
    where: { teamId },
    select: { id: true, name: true, role: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ members });
}
```

- [ ] **Step 2: Test the endpoint manually**

Run dev server (`npm run dev`) and visit `http://localhost:3000/api/team/members` while logged in as TEAM_LEADER. Should return `{ members: [...] }`. Without token → 401. As AGENT → 403.

- [ ] **Step 3: Commit**

```bash
git add app/api/team/members/route.ts
git commit -m "feat: add GET /api/team/members endpoint for team leader"
```

---

## Task 2: Extend `/api/evaluations` with date and agentIds filtering

**Files:**
- Modify: `app/api/evaluations/route.ts`

- [ ] **Step 1: Update the GET handler**

Replace the existing `GET` function in `app/api/evaluations/route.ts` with:

```typescript
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const agentIdsParam = params.get("agentIds");

  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
    },
  } : {};

  let agentIdFilter: string[] | null = null;

  if (agentIdsParam) {
    const requested = agentIdsParam.split(",").filter(Boolean);
    if (user.role === "AGENT") {
      // AGENT can only see themselves — ignore param
      agentIdFilter = [user.id];
    } else if (user.role === "TEAM_LEADER") {
      const teamMembers = await prisma.user.findMany({
        where: { teamId: user.teamId },
        select: { id: true },
      });
      const allowedIds = new Set(teamMembers.map((m: any) => m.id));
      const filtered = requested.filter(id => allowedIds.has(id));
      if (filtered.length !== requested.length) {
        return NextResponse.json({ error: "Yetkisiz danışman ID'si." }, { status: 403 });
      }
      agentIdFilter = filtered;
    } else {
      agentIdFilter = requested;
    }
  }

  let whereBase: any = { ...dateFilter };

  if (user.role === "AGENT") {
    whereBase.agentId = user.id;
  } else if (user.role === "TEAM_LEADER" && !agentIdFilter) {
    const teamMembers = await prisma.user.findMany({
      where: { teamId: user.teamId },
      select: { id: true },
    });
    whereBase.agentId = { in: teamMembers.map((m: any) => m.id) };
  } else if (agentIdFilter) {
    whereBase.agentId = { in: agentIdFilter };
  }

  const evaluations = await prisma.evaluation.findMany({
    where: whereBase,
    include: { agent: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ evaluations });
}
```

- [ ] **Step 2: Verify existing behavior unchanged**

As AGENT: `GET /api/evaluations` still returns only own evaluations.
As TEAM_LEADER: returns team evaluations.
As ADMIN: returns all.
With `?agentIds=x,y` as TEAM_LEADER where x or y is outside team → 403.

- [ ] **Step 3: Commit**

```bash
git add app/api/evaluations/route.ts
git commit -m "feat: add agentIds/startDate/endDate filtering to evaluations API"
```

---

## Task 3: Extend `/api/scores` with date filtering

**Files:**
- Modify: `app/api/scores/route.ts`

- [ ] **Step 1: Add date filter to evaluations query**

In `app/api/scores/route.ts`, after line `const agentId = req.nextUrl.searchParams.get("agentId") || user.id;`, add:

```typescript
const startDate = req.nextUrl.searchParams.get("startDate");
const endDate = req.nextUrl.searchParams.get("endDate");

const dateFilter = startDate || endDate ? {
  createdAt: {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
  },
} : {};
```

Then change the `prisma.evaluation.findMany` call (around line 33) to include the date filter:

```typescript
const evaluations = await prisma.evaluation.findMany({
  where: { agentId, ...dateFilter },
  orderBy: { createdAt: "desc" },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/api/scores/route.ts
git commit -m "feat: add startDate/endDate filtering to scores API"
```

---

## Task 4: Create shared `KPISummary` component

**Files:**
- Create: `app/components/shared/KPISummary.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/components/shared/KPISummary.tsx
"use client";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

interface KPISummaryProps {
  avgScore: number;
  totalCalls: number;
  highestScore: number;
  labels?: {
    avgScore?: string;
    performance?: string;
    calls?: string;
  };
}

export default function KPISummary({ avgScore, totalCalls, highestScore, labels = {} }: KPISummaryProps) {
  const { avgScore: avgLabel = "Ortalama Skor", performance: perfLabel = "Performans", calls: callsLabel = "Toplam Arama" } = labels;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[180px]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-slate-400 text-sm font-semibold tracking-wider">{avgLabel.toUpperCase()}</div>
            <MIcon name="insights" className="text-primary" />
          </div>
          <div className="font-headline text-6xl font-black text-white">{avgScore}<span className="text-2xl text-primary">%</span></div>
        </div>
        <div className="w-full bg-surface-container-lowest h-2 rounded-full overflow-hidden mt-4">
          <div className="bg-primary h-full transition-all" style={{ width: `${avgScore}%` }} />
        </div>
      </div>

      <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[180px]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-slate-400 text-sm font-semibold tracking-wider">{perfLabel.toUpperCase()}</div>
            <MIcon name="verified_user" className="text-primary" />
          </div>
          <div className="font-headline text-6xl font-black text-white">{(avgScore / 10).toFixed(1)}<span className="text-2xl text-primary">/10</span></div>
        </div>
      </div>

      <div className="bg-surface-container rounded-3xl p-8 flex flex-col justify-between min-h-[180px]">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-slate-400 text-sm font-semibold tracking-wider">{callsLabel.toUpperCase()}</div>
            <MIcon name="call" className="text-primary" />
          </div>
          <div className="font-headline text-6xl font-black text-white">{totalCalls}</div>
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-sm mt-4">
          <MIcon name="emoji_events" className="text-amber-400 text-sm" />
          <span>En yüksek: %{highestScore}</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/shared/KPISummary.tsx
git commit -m "feat: add shared KPISummary component"
```

---

## Task 5: Create shared `EvaluationList` component

**Files:**
- Create: `app/components/shared/EvaluationList.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/components/shared/EvaluationList.tsx
"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const scoreColor = (score: number) =>
  score >= 85 ? "text-emerald-400" :
  score >= 70 ? "text-primary" :
  score >= 55 ? "text-amber-400" : "text-error";

interface Evaluation {
  id: string;
  score: number;
  customerName: string;
  callDuration: string;
  createdAt: string;
  agent?: { name: string };
}

interface EvaluationListProps {
  evaluations: Evaluation[];
  showAgent?: boolean;
  detailLabel?: string;
  emptyMessage?: string;
}

export default function EvaluationList({
  evaluations,
  showAgent = true,
  detailLabel = "Detay",
  emptyMessage = "Henüz değerlendirme yok.",
}: EvaluationListProps) {
  if (evaluations.length === 0) {
    return (
      <div className="py-16 text-center">
        <MIcon name="call" className="text-6xl opacity-10 block mx-auto mb-4" />
        <p className="text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-container rounded-3xl p-6 space-y-2">
      {evaluations.map((ev, i) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-high transition-colors cursor-pointer group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <MIcon name="description" />
          </div>
          <div className="flex-1">
            {showAgent && <div className="font-semibold text-on-surface">{ev.agent?.name}</div>}
            <div className="text-xs text-slate-500">{ev.customerName} · {ev.callDuration}</div>
          </div>
          <div className="text-right flex items-center gap-4">
            <p className="text-xs text-slate-500">{new Date(ev.createdAt).toLocaleDateString("tr-TR")}</p>
            <div className={`font-bold ${scoreColor(ev.score)}`}>%{ev.score}</div>
            <Link href={`/evaluation/${ev.id}`}>
              <div className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-primary transition-colors">
                {detailLabel} <ArrowUpRight size={12} />
              </div>
            </Link>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/shared/EvaluationList.tsx
git commit -m "feat: add shared EvaluationList component"
```

---

## Task 6: Create shared `ScoreView` component

**Files:**
- Create: `app/components/shared/ScoreView.tsx`

- [ ] **Step 1: Create the component**

Extract the scores display from the existing `page.tsx` scores tab (lines 641–694). This component receives `scoresData` as a prop and renders the full score profile, stats, weekly progress, and recent calls.

```typescript
// app/components/shared/ScoreView.tsx
"use client";

import Link from "next/link";
import { motion } from "motion/react";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const scoreColor = (s: number) =>
  s >= 85 ? "text-emerald-400" : s >= 70 ? "text-primary" : s >= 55 ? "text-amber-400" : "text-error";

const scoreBg = (s: number) =>
  s >= 85 ? "bg-emerald-500" : s >= 70 ? "bg-primary" : s >= 55 ? "bg-amber-500" : "bg-red-500";

interface ScoreData {
  agent: { id: string; name: string; role: string; team: string };
  rank: number;
  totalAgents: number;
  stats: { totalCalls: number; avgScore: number; highestScore: number };
  weeklyProgress: { week: string; score: number; calls: number }[];
  recentCalls: { id: string; date: string; customer: string; score: number; callType: string; duration: string }[];
  isDemo?: boolean;
}

export default function ScoreView({ data }: { data: ScoreData }) {
  const { agent, rank, totalAgents, stats, weeklyProgress, recentCalls, isDemo } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-surface-container rounded-3xl p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xl font-black">
            {agent.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{agent.name}</h2>
              {isDemo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>}
            </div>
            <p className="text-sm text-slate-400 flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold border border-primary/20 bg-primary/10 text-primary">{agent.team}</span>
              <span className="flex items-center gap-1"><MIcon name="emoji_events" className="text-amber-400 text-sm" /> #{rank} / {totalAgents}</span>
            </p>
          </div>
        </div>
        <div className={`font-headline text-6xl font-black ${scoreColor(stats.avgScore)}`}>%{stats.avgScore}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        {[
          { label: "Toplam Arama", value: stats.totalCalls, color: "text-primary" },
          { label: "Ortalama Skor", value: `%${stats.avgScore}`, color: "text-emerald-400" },
          { label: "En Yüksek", value: `%${stats.highestScore}`, color: "text-amber-400" },
        ].map(s => (
          <div key={s.label} className="bg-surface-container rounded-3xl p-6">
            <p className="text-slate-400 text-sm font-semibold tracking-wider mb-2">{s.label.toUpperCase()}</p>
            <p className={`font-headline text-4xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Weekly Progress */}
      <div className="bg-surface-container rounded-3xl p-8">
        <h3 className="font-headline text-lg font-bold mb-6 flex items-center gap-2">
          <MIcon name="trending_up" className="text-emerald-400" /> Haftalık Gelişim
        </h3>
        <div className="space-y-4">
          {weeklyProgress.map((week, idx) => {
            const prev = idx > 0 ? weeklyProgress[idx - 1].score : week.score;
            const change = week.score - prev;
            return (
              <div key={week.week} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MIcon name="calendar_today" className="text-slate-500 text-sm" />
                  <span className="text-sm text-slate-400">{week.week}</span>
                  <span className="text-[10px] text-slate-600">({week.calls} arama)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-surface-container-lowest rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${scoreBg(week.score)}`} style={{ width: `${week.score}%` }} />
                  </div>
                  <span className={`font-bold text-sm ${scoreColor(week.score)}`}>%{week.score}</span>
                  {idx > 0 && change !== 0 && (
                    <span className={`text-xs flex items-center ${change > 0 ? "text-emerald-400" : "text-error"}`}>
                      {change > 0 ? "+" : ""}{change}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Calls */}
      <div className="bg-surface-container rounded-3xl p-6 space-y-2">
        <h3 className="font-headline text-lg font-bold px-4 py-2 flex items-center gap-2">
          <MIcon name="call" className="text-primary" /> Son Aramalar
        </h3>
        {recentCalls.map((call, i) => (
          <motion.div key={call.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-container-high transition-colors">
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">{call.date}</span>
              <span className="text-sm font-medium">{call.customer}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`font-bold ${scoreColor(call.score)}`}>%{call.score}</span>
              {!call.id.startsWith("demo-") && (
                <Link href={`/evaluation/${call.id}`}>
                  <span className="text-xs text-slate-500 hover:text-primary transition-colors">Detay</span>
                </Link>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/shared/ScoreView.tsx
git commit -m "feat: add shared ScoreView component"
```

---

## Task 7: Create shared `ReportsView` component

**Files:**
- Create: `app/components/shared/ReportsView.tsx`

- [ ] **Step 1: Create the component**

This wraps the weekly auto-report section from page.tsx (lines 721–769). Props: `agentId?: string` (if provided, scopes the auto-report to that agent).

```typescript
// app/components/shared/ReportsView.tsx
"use client";

import { useState, useEffect } from "react";
import WeeklyEvaluationReport from "@/components/WeeklyEvaluationReport";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

interface ReportsViewProps {
  agentId?: string;
}

export default function ReportsView({ agentId }: ReportsViewProps) {
  const [autoReportData, setAutoReportData] = useState<any>(null);
  const [autoReportPeriod, setAutoReportPeriod] = useState<any>(null);
  const [autoReportIsDemo, setAutoReportIsDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => { fetchReport(); }, [agentId]);

  const fetchReport = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      if (agentId) params.set("agentId", agentId);
      const url = `/api/reports/auto${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        setAutoReportData(result.data);
        setAutoReportPeriod(result.period);
        setAutoReportIsDemo(result.isDemo || false);
      }
    } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="bg-surface-container rounded-3xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              {startDate || endDate ? "Özel Tarih Aralığı" : "Son 7 Gün"} — Haftalık Rapor
              {autoReportIsDemo && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">DEMO</span>}
            </p>
            {autoReportPeriod && (
              <p className="text-xs text-slate-500 mt-1">
                {new Date(autoReportPeriod.start).toLocaleDateString("tr-TR")} — {new Date(autoReportPeriod.end).toLocaleDateString("tr-TR")}
              </p>
            )}
          </div>
          <button onClick={() => { setAutoReportData(null); setStartDate(""); setEndDate(""); fetchReport(); }}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <MIcon name="refresh" className="text-lg" /> Yenile
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Başlangıç</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Bitiş</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
          </div>
          <div className="pt-4">
            <button onClick={() => { setAutoReportData(null); fetchReport(startDate || undefined, endDate || undefined); }}
              className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-5 py-2 rounded-xl text-sm hover:shadow-lg transition-all">
              Uygula
            </button>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="py-24 text-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" />
        </div>
      ) : (
        <WeeklyEvaluationReport data={autoReportData} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/shared/ReportsView.tsx
git commit -m "feat: add shared ReportsView component"
```

---

## Task 8: Create `TeamMemberPicker` and `DateRangePicker` components

**Files:**
- Create: `app/components/shared/TeamMemberPicker.tsx`
- Create: `app/components/shared/DateRangePicker.tsx`

- [ ] **Step 1: Create `TeamMemberPicker`**

```typescript
// app/components/shared/TeamMemberPicker.tsx
"use client";

interface Member {
  id: string;
  name: string;
  role: string;
}

interface TeamMemberPickerProps {
  members: Member[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function TeamMemberPicker({ members, selectedIds, onChange }: TeamMemberPickerProps) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const allSelected = members.length > 0 && selectedIds.length === members.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : members.map(m => m.id));
  };

  return (
    <div className="bg-surface-container rounded-3xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Danışmanlar</h3>
        <button onClick={toggleAll} className="text-xs text-primary hover:underline">
          {allSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
        </button>
      </div>
      <div className="space-y-2">
        {members.map(m => (
          <label key={m.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={selectedIds.includes(m.id)}
              onChange={() => toggle(m.id)}
              className="w-4 h-4 accent-primary"
            />
            <div className="w-8 h-8 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary text-xs font-bold">
              {m.name.charAt(0)}
            </div>
            <span className="text-sm font-medium text-on-surface">{m.name}</span>
          </label>
        ))}
        {members.length === 0 && <p className="text-slate-500 text-sm text-center py-4">Takımda danışman yok.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `DateRangePicker`**

```typescript
// app/components/shared/DateRangePicker.tsx
"use client";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onApply: () => void;
}

export default function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, onApply }: DateRangePickerProps) {
  return (
    <div className="bg-surface-container rounded-3xl p-6 flex items-end gap-3">
      <div className="flex-1">
        <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Başlangıç</label>
        <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)}
          className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
      </div>
      <div className="flex-1">
        <label className="text-[10px] text-slate-500 uppercase tracking-widest block mb-1">Bitiş</label>
        <input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)}
          className="w-full bg-surface-container-lowest border-none rounded-xl px-4 py-2 text-sm text-white focus:ring-1 focus:ring-primary" />
      </div>
      <button onClick={onApply}
        className="bg-gradient-to-r from-primary to-tertiary text-on-primary font-bold px-5 py-2 rounded-xl text-sm hover:shadow-lg transition-all">
        Uygula
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/TeamMemberPicker.tsx app/components/shared/DateRangePicker.tsx
git commit -m "feat: add TeamMemberPicker and DateRangePicker shared components"
```

---

## Task 9: Create `AgentDashboard`

**Files:**
- Create: `app/components/dashboards/AgentDashboard.tsx`

- [ ] **Step 1: Create the component**

This is a self-contained dashboard for AGENT role. It fetches its own data and renders 4 tabs using the shared components.

```typescript
// app/components/dashboards/AgentDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import KPISummary from "@/app/components/shared/KPISummary";
import EvaluationList from "@/app/components/shared/EvaluationList";
import ScoreView from "@/app/components/shared/ScoreView";
import ReportsView from "@/app/components/shared/ReportsView";
import { motion } from "motion/react";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

interface AgentDashboardProps {
  user: { id: string; name: string; role: string; email: string };
  isDark: boolean;
  lang: "tr" | "en";
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onLogout: () => void;
}

export default function AgentDashboard({ user, isDark, lang, onToggleTheme, onToggleLang, onLogout }: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState("home");
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [scoresData, setScoresData] = useState<any>(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [navSearch, setNavSearch] = useState("");

  useEffect(() => {
    fetch("/api/evaluations").then(r => r.json()).then(d => setEvaluations(d.evaluations || []));
  }, []);

  const fetchScores = async () => {
    setScoresLoading(true);
    const res = await fetch("/api/scores");
    if (res.ok) setScoresData((await res.json()));
    setScoresLoading(false);
  };

  const avgScore = evaluations.length ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / evaluations.length) : 0;
  const highestScore = evaluations.length ? Math.max(...evaluations.map(e => e.score)) : 0;

  const navItems = [
    { key: "home", icon: "home", label: "Ana Sayfa" },
    { key: "calls", icon: "call", label: "Aramalarım" },
    { key: "scores", icon: "star", label: "Skorlarım" },
    { key: "reports", icon: "assessment", label: "Raporlarım" },
  ];

  return (
    <div className="flex min-h-screen bg-surface text-on-surface font-sans">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto bg-surface-container-low shadow-[0px_24px_48px_rgba(0,27,60,0.2)] flex flex-col py-8 px-4 justify-between z-50">
        <div>
          <div className="flex flex-col items-center mb-10">
            <div className="animate-3d-rotate w-16 h-16 mb-4">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-tertiary opacity-80" />
            </div>
            <div className="font-headline text-2xl font-extrabold tracking-tighter text-primary drop-shadow-lg">Estenove</div>
            <div className="text-xs text-slate-400 tracking-widest uppercase mt-1">Satış Performansı</div>
          </div>

          <div className="relative mb-3">
            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none" />
            <input type="text" value={navSearch} onChange={(e) => setNavSearch(e.target.value)} placeholder="Ara..."
              className="w-full bg-surface-container rounded-xl pl-9 pr-8 py-2 text-xs text-on-surface placeholder-slate-500 border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
          </div>

          <nav className="space-y-1">
            {navItems.filter(i => i.label.toLowerCase().includes(navSearch.toLowerCase())).map(item => (
              <a key={item.key}
                onClick={() => { setActiveTab(item.key); setNavSearch(""); if (item.key === "scores" && !scoresData) fetchScores(); }}
                className={`flex items-center gap-3 py-3 px-4 transition-all duration-300 font-sans text-sm cursor-pointer rounded-xl ${
                  activeTab === item.key
                    ? "text-primary border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent font-semibold"
                    : "text-slate-400 hover:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <MIcon name={item.icon} /> {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-outline-variant">
          <a onClick={onLogout} className="flex items-center gap-3 py-3 px-4 text-slate-400 hover:text-on-surface transition-colors font-sans text-sm cursor-pointer">
            <MIcon name="logout" /> Çıkış
          </a>
          <div className="mt-4 p-3 bg-surface-bright rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xs font-bold">
              {user.name?.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400">Danışman</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 min-h-screen">
        <header className="flex items-center justify-end px-10 py-6 w-full sticky top-0 z-40 backdrop-blur-lg bg-surface/80 gap-3">
          <button onClick={onToggleLang}
            className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all text-xs font-bold tracking-wide">
            <MIcon name="translate" className="text-base" />
            {lang === "tr" ? "TR" : "EN"}
          </button>
          <button onClick={onToggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all">
            <MIcon name={isDark ? "light_mode" : "dark_mode"} className="text-xl" />
          </button>
        </header>

        <div className="px-10 pb-12 space-y-8">
          {/* HOME */}
          {activeTab === "home" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Merhaba, {user.name.split(" ")[0]} 👋</h1>
                <p className="text-sm text-slate-400 mt-1">Performans özetin aşağıda.</p>
              </motion.div>
              <KPISummary avgScore={avgScore} totalCalls={evaluations.length} highestScore={highestScore} />
              <div className="bg-surface-container rounded-3xl p-10">
                <h3 className="font-headline text-2xl font-bold mb-6">Son Değerlendirmeler</h3>
                <EvaluationList evaluations={evaluations.slice(0, 4)} showAgent={false} />
              </div>
            </>
          )}

          {/* CALLS */}
          {activeTab === "calls" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Aramalarım</h1>
                <p className="text-sm text-slate-400 mt-1">Tüm değerlendirmelerini görüntüle.</p>
              </motion.div>
              <EvaluationList evaluations={evaluations} showAgent={false} />
            </>
          )}

          {/* SCORES */}
          {activeTab === "scores" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Skorlarım</h1>
              </motion.div>
              {scoresLoading ? (
                <div className="py-24 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : scoresData ? (
                <ScoreView data={scoresData} />
              ) : (
                <div className="py-24 text-center"><MIcon name="star" className="text-6xl opacity-10 block mx-auto mb-4" /><p className="text-slate-500">Yükleniyor...</p></div>
              )}
            </>
          )}

          {/* REPORTS */}
          {activeTab === "reports" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Raporlarım</h1>
              </motion.div>
              <ReportsView agentId={user.id} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/dashboards/AgentDashboard.tsx
git commit -m "feat: add AgentDashboard component"
```

---

## Task 10: Create `TeamLeaderDashboard`

**Files:**
- Create: `app/components/dashboards/TeamLeaderDashboard.tsx`

- [ ] **Step 1: Create the component**

Extends AgentDashboard with a 5th "Takımım" tab that uses `TeamMemberPicker`, `DateRangePicker`, `ScoreView`, and `EvaluationList`.

```typescript
// app/components/dashboards/TeamLeaderDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import KPISummary from "@/app/components/shared/KPISummary";
import EvaluationList from "@/app/components/shared/EvaluationList";
import ScoreView from "@/app/components/shared/ScoreView";
import ReportsView from "@/app/components/shared/ReportsView";
import TeamMemberPicker from "@/app/components/shared/TeamMemberPicker";
import DateRangePicker from "@/app/components/shared/DateRangePicker";

const MIcon = ({ name, className = "" }: { name: string; className?: string }) => (
  <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

interface TeamLeaderDashboardProps {
  user: { id: string; name: string; role: string; email: string };
  isDark: boolean;
  lang: "tr" | "en";
  onToggleTheme: () => void;
  onToggleLang: () => void;
  onLogout: () => void;
}

export default function TeamLeaderDashboard({ user, isDark, lang, onToggleTheme, onToggleLang, onLogout }: TeamLeaderDashboardProps) {
  const [activeTab, setActiveTab] = useState("home");
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [scoresData, setScoresData] = useState<any>(null);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [navSearch, setNavSearch] = useState("");

  // Team tab state
  const [members, setMembers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teamEvals, setTeamEvals] = useState<any[]>([]);
  const [teamEvalsLoading, setTeamEvalsLoading] = useState(false);
  const [selectedMemberScore, setSelectedMemberScore] = useState<any>(null);
  const [memberScoreLoading, setMemberScoreLoading] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);

  useEffect(() => {
    fetch("/api/evaluations").then(r => r.json()).then(d => setEvaluations(d.evaluations || []));
    fetch("/api/team/members").then(r => r.json()).then(d => setMembers(d.members || []));
  }, []);

  const fetchScores = async () => {
    setScoresLoading(true);
    const res = await fetch("/api/scores");
    if (res.ok) setScoresData(await res.json());
    setScoresLoading(false);
  };

  const fetchTeamEvals = async () => {
    setTeamEvalsLoading(true);
    const params = new URLSearchParams();
    if (selectedIds.length) params.set("agentIds", selectedIds.join(","));
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const res = await fetch(`/api/evaluations?${params}`);
    if (res.ok) setTeamEvals((await res.json()).evaluations || []);
    setTeamEvalsLoading(false);
  };

  const openMemberDetail = async (memberId: string) => {
    setMemberScoreLoading(true);
    setMemberModalOpen(true);
    const params = new URLSearchParams({ agentId: memberId });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const res = await fetch(`/api/scores?${params}`);
    if (res.ok) setSelectedMemberScore(await res.json());
    setMemberScoreLoading(false);
  };

  const avgScore = evaluations.length ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / evaluations.length) : 0;
  const highestScore = evaluations.length ? Math.max(...evaluations.map(e => e.score)) : 0;

  const teamAvgScore = teamEvals.length ? Math.round(teamEvals.reduce((a, e) => a + e.score, 0) / teamEvals.length) : 0;
  const teamHighest = teamEvals.length ? Math.max(...teamEvals.map(e => e.score)) : 0;

  const navItems = [
    { key: "home", icon: "home", label: "Ana Sayfa" },
    { key: "calls", icon: "call", label: "Aramalarım" },
    { key: "scores", icon: "star", label: "Skorlarım" },
    { key: "reports", icon: "assessment", label: "Raporlarım" },
    { key: "team", icon: "group", label: "Takımım" },
  ];

  return (
    <div className="flex min-h-screen bg-surface text-on-surface font-sans">
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto bg-surface-container-low shadow-[0px_24px_48px_rgba(0,27,60,0.2)] flex flex-col py-8 px-4 justify-between z-50">
        <div>
          <div className="flex flex-col items-center mb-10">
            <div className="animate-3d-rotate w-16 h-16 mb-4">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-tertiary opacity-80" />
            </div>
            <div className="font-headline text-2xl font-extrabold tracking-tighter text-primary drop-shadow-lg">Estenove</div>
            <div className="text-xs text-slate-400 tracking-widest uppercase mt-1">Satış Performansı</div>
          </div>

          <div className="relative mb-3">
            <MIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-base pointer-events-none" />
            <input type="text" value={navSearch} onChange={(e) => setNavSearch(e.target.value)} placeholder="Ara..."
              className="w-full bg-surface-container rounded-xl pl-9 pr-8 py-2 text-xs text-on-surface placeholder-slate-500 border border-outline-variant/40 focus:outline-none focus:ring-1 focus:ring-primary transition-all" />
          </div>

          <nav className="space-y-1">
            {navItems.filter(i => i.label.toLowerCase().includes(navSearch.toLowerCase())).map(item => (
              <a key={item.key}
                onClick={() => {
                  setActiveTab(item.key); setNavSearch("");
                  if (item.key === "scores" && !scoresData) fetchScores();
                  if (item.key === "team" && teamEvals.length === 0) fetchTeamEvals();
                }}
                className={`flex items-center gap-3 py-3 px-4 transition-all duration-300 font-sans text-sm cursor-pointer rounded-xl ${
                  activeTab === item.key
                    ? "text-primary border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent font-semibold"
                    : "text-slate-400 hover:text-on-surface hover:bg-surface-container-highest"
                }`}
              >
                <MIcon name={item.icon} /> {item.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-outline-variant">
          <a onClick={onLogout} className="flex items-center gap-3 py-3 px-4 text-slate-400 hover:text-on-surface transition-colors font-sans text-sm cursor-pointer">
            <MIcon name="logout" /> Çıkış
          </a>
          <div className="mt-4 p-3 bg-surface-bright rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary text-xs font-bold">
              {user.name?.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-xs font-semibold truncate">{user.name}</div>
              <div className="text-[10px] text-slate-400">Takım Lideri</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 flex-1 min-h-screen">
        <header className="flex items-center justify-end px-10 py-6 w-full sticky top-0 z-40 backdrop-blur-lg bg-surface/80 gap-3">
          <button onClick={onToggleLang}
            className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all text-xs font-bold tracking-wide">
            <MIcon name="translate" className="text-base" />{lang === "tr" ? "TR" : "EN"}
          </button>
          <button onClick={onToggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container hover:bg-surface-container-high text-slate-400 hover:text-primary transition-all">
            <MIcon name={isDark ? "light_mode" : "dark_mode"} className="text-xl" />
          </button>
        </header>

        <div className="px-10 pb-12 space-y-8">
          {/* HOME */}
          {activeTab === "home" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Merhaba, {user.name.split(" ")[0]} 👋</h1>
                <p className="text-sm text-slate-400 mt-1">Kendi performans özetin aşağıda.</p>
              </motion.div>
              <KPISummary avgScore={avgScore} totalCalls={evaluations.length} highestScore={highestScore} />
              <div className="bg-surface-container rounded-3xl p-10">
                <h3 className="font-headline text-2xl font-bold mb-6">Son Değerlendirmeler</h3>
                <EvaluationList evaluations={evaluations.slice(0, 4)} showAgent={false} />
              </div>
            </>
          )}

          {/* CALLS */}
          {activeTab === "calls" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Aramalarım</h1>
              </motion.div>
              <EvaluationList evaluations={evaluations} showAgent={false} />
            </>
          )}

          {/* SCORES */}
          {activeTab === "scores" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Skorlarım</h1>
              </motion.div>
              {scoresLoading ? (
                <div className="py-24 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : scoresData ? (
                <ScoreView data={scoresData} />
              ) : null}
            </>
          )}

          {/* REPORTS */}
          {activeTab === "reports" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Raporlarım</h1>
              </motion.div>
              <ReportsView agentId={user.id} />
            </>
          )}

          {/* TEAM */}
          {activeTab === "team" && (
            <>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="font-headline text-3xl font-bold text-white">Takımım</h1>
                <p className="text-sm text-slate-400 mt-1">Danışmanları seç, tarih aralığı belirle, skorları karşılaştır.</p>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                  <TeamMemberPicker members={members} selectedIds={selectedIds} onChange={setSelectedIds} />
                  <DateRangePicker
                    startDate={startDate} endDate={endDate}
                    onStartChange={setStartDate} onEndChange={setEndDate}
                    onApply={fetchTeamEvals}
                  />
                </div>

                <div className="lg:col-span-2 space-y-6">
                  {/* Team KPI Summary */}
                  {teamEvals.length > 0 && (
                    <KPISummary
                      avgScore={teamAvgScore}
                      totalCalls={teamEvals.length}
                      highestScore={teamHighest}
                      labels={{ avgScore: "Takım Ortalaması", performance: "Takım Performansı", calls: "Toplam Arama" }}
                    />
                  )}

                  {/* Member cards with click-to-detail */}
                  <div className="bg-surface-container rounded-3xl p-6">
                    <h3 className="font-headline text-lg font-bold text-white mb-4">Danışman Skorları</h3>
                    <div className="space-y-2">
                      {members.filter(m => selectedIds.length === 0 || selectedIds.includes(m.id)).map((m, i) => {
                        const memberEvals = teamEvals.filter(e => e.agent?.name === m.name || e.agentId === m.id);
                        const mAvg = memberEvals.length ? Math.round(memberEvals.reduce((a, e) => a + e.score, 0) / memberEvals.length) : null;
                        return (
                          <motion.div key={m.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                            onClick={() => openMemberDetail(m.id)}
                            className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest hover:bg-surface-container-high transition-colors cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary font-bold group-hover:scale-110 transition-transform">
                                {m.name.charAt(0)}
                              </div>
                              <p className="text-sm font-semibold">{m.name}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {mAvg !== null ? (
                                <span className={`font-headline text-xl font-black ${mAvg >= 85 ? "text-emerald-400" : mAvg >= 70 ? "text-primary" : mAvg >= 55 ? "text-amber-400" : "text-error"}`}>%{mAvg}</span>
                              ) : (
                                <span className="text-slate-500 text-sm">—</span>
                              )}
                              <MIcon name="chevron_right" className="text-slate-500 group-hover:text-primary transition-colors" />
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Team evaluations list */}
                  {teamEvalsLoading ? (
                    <div className="py-12 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
                  ) : (
                    <EvaluationList evaluations={teamEvals} showAgent={true} emptyMessage="Filtre uygula ve 'Uygula' butonuna bas." />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Member Detail Modal */}
      <AnimatePresence>
        {memberModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
            onClick={() => setMemberModalOpen(false)}>
            <motion.div initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }}
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full max-w-2xl bg-surface overflow-y-auto p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-headline text-2xl font-bold text-white">Danışman Detayı</h2>
                <button onClick={() => setMemberModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                  <MIcon name="close" className="text-2xl" />
                </button>
              </div>
              {memberScoreLoading ? (
                <div className="py-24 text-center"><div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin mx-auto" /></div>
              ) : selectedMemberScore ? (
                <ScoreView data={selectedMemberScore} />
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/dashboards/TeamLeaderDashboard.tsx
git commit -m "feat: add TeamLeaderDashboard component with team comparison and member detail modal"
```

---

## Task 11: Move existing page.tsx content to `AdminDashboard`

**Files:**
- Create: `app/components/dashboards/AdminDashboard.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `AdminDashboard.tsx`**

Cut the entire content of `app/page.tsx` (the `DashboardPage` component and all its helpers — `EvalItem`, `MIcon`, all state, all handlers, the full JSX) and paste it into a new file `app/components/dashboards/AdminDashboard.tsx`. Rename the exported function from `DashboardPage` to `AdminDashboard`. Add the two props it needs from the parent: `user` (to avoid re-fetching) as a prop, keeping the rest of the internal state as-is.

The simplest approach: copy the whole file as-is into AdminDashboard.tsx, rename the export, and add:

```typescript
// At the top of the component, accept initial user so we skip the auth/me call:
interface AdminDashboardProps {
  user: any;
}
export default function AdminDashboard({ user: initialUser }: AdminDashboardProps) {
  // Replace the useState for currentUser with initialUser:
  const [currentUser] = useState<any>(initialUser);
  const [isLoading] = useState(false);
  // ... rest of existing state and logic unchanged
```

Remove the `fetchCurrentUser` function and its `useEffect` since `currentUser` is now passed as prop.

- [ ] **Step 2: Replace `app/page.tsx` with thin router**

```typescript
// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AgentDashboard from "@/app/components/dashboards/AgentDashboard";
import TeamLeaderDashboard from "@/app/components/dashboards/TeamLeaderDashboard";
import AdminDashboard from "@/app/components/dashboards/AdminDashboard";

export default function RootPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [lang, setLang] = useState<"tr" | "en">("tr");

  useEffect(() => {
    const savedTheme = localStorage.getItem("estenove-theme");
    setIsDark(savedTheme !== "light");
    document.documentElement.classList.toggle("light", savedTheme === "light");

    const savedLang = localStorage.getItem("estenove-lang") as "tr" | "en" | null;
    if (savedLang === "en" || savedLang === "tr") setLang(savedLang);

    fetch("/api/auth/me").then(r => r.json()).then(data => {
      if (!data.user) { router.replace("/login"); return; }
      setUser(data.user);
    }).finally(() => setLoading(false));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("light", !next);
    localStorage.setItem("estenove-theme", next ? "dark" : "light");
  };

  const toggleLang = () => {
    const next: "tr" | "en" = lang === "tr" ? "en" : "tr";
    setLang(next);
    localStorage.setItem("estenove-lang", next);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const sharedProps = { user, isDark, lang, onToggleTheme: toggleTheme, onToggleLang: toggleLang, onLogout: handleLogout };

  if (user.role === "AGENT") return <AgentDashboard {...sharedProps} />;
  if (user.role === "TEAM_LEADER") return <TeamLeaderDashboard {...sharedProps} />;
  return <AdminDashboard user={user} />;
}
```

- [ ] **Step 3: Run dev server and verify**

```bash
npm run dev
```

- Login as ADMIN → AdminDashboard renders (full existing UI, no regressions)
- Login as AGENT → AgentDashboard renders (4 tabs, no admin sections)
- Login as TEAM_LEADER → TeamLeaderDashboard renders (5 tabs including Takımım)

- [ ] **Step 4: Commit**

```bash
git add app/components/dashboards/AdminDashboard.tsx app/page.tsx
git commit -m "feat: refactor page.tsx to role-based router, move admin view to AdminDashboard"
```

---

## Task 12: Add `agentId` support to `/api/reports/auto` for AGENT/TL scoping

**Files:**
- Modify: `app/api/reports/auto/route.ts`

- [ ] **Step 1: Read the current file**

Read `app/api/reports/auto/route.ts` to understand its structure before modifying.

- [ ] **Step 2: Add agentId filter**

After token verification, extract optional `agentId` param. If present and user is AGENT, enforce `agentId === user.id`. If user is TEAM_LEADER, verify the agentId belongs to their team. Then scope all evaluation queries with `where: { agentId }`.

The exact implementation depends on the current file's query structure — read first, then apply the filter pattern already established in Task 2.

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/auto/route.ts
git commit -m "feat: scope auto-reports by agentId for agent/team-leader views"
```

---

## Self-Review Checklist

- [x] `GET /api/team/members` — Task 1 ✓
- [x] `GET /api/evaluations` with `agentIds`/`startDate`/`endDate` — Task 2 ✓
- [x] `GET /api/scores` with `startDate`/`endDate` — Task 3 ✓
- [x] Shared `KPISummary` — Task 4 ✓
- [x] Shared `EvaluationList` — Task 5 ✓
- [x] Shared `ScoreView` — Task 6 ✓
- [x] Shared `ReportsView` — Task 7 ✓
- [x] `TeamMemberPicker` + `DateRangePicker` — Task 8 ✓
- [x] `AgentDashboard` — Task 9 ✓
- [x] `TeamLeaderDashboard` with Takımım tab + member modal — Task 10 ✓
- [x] `AdminDashboard` + thin `page.tsx` router — Task 11 ✓
- [x] Auto-report agentId scoping — Task 12 ✓
- [x] Security: AGENT locked to own data in all API routes ✓
- [x] Security: TEAM_LEADER agentIds validated against teamId ✓
- [x] ADMIN/MANAGER: no change to existing behavior ✓
