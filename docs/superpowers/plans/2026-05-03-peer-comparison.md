# Peer Comparison & Yönetim Karşılaştırması — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Nasıl Gidiyorum?" tab (Agent/TL: self vs team avg) and "Karşılaştırma" tab (Admin/Manager: filterable agent comparison) to existing dashboards.

**Architecture:** Two new API routes (`/api/scores/peer`, `/api/scores/compare`) + two new React components (`PeerComparisonView`, `ManagementComparisonView`) wired into the existing tab-based dashboard system. No DB schema changes; uses existing `sectionScores` and `weakCriteria` JSON fields. One prompt update adds a `section` field to `weakCriteria` items to enable per-section accordion filtering.

**Tech Stack:** Next.js 15 App Router, Prisma + PostgreSQL (Supabase), React hooks, inline styles (matching existing pattern in this codebase), `pg` Node client for direct DB prompt update.

---

## Codebase Context

- Auth: `getUserFromToken(req)` from `@/app/lib/auth` — returns JWT payload with `id`, `role`, `teamId` fields
- Prisma client: import from `@/app/lib/prisma` (NOT `@prisma/client`)
- Dashboard pattern: each role renders its own dashboard component (`AgentDashboard`, `TeamLeaderDashboard`, `AdminDashboard`), each with a `navItems` array and `activeTab` state
- AdminDashboard serves both ADMIN and MANAGER roles internally (checks `["ADMIN","MANAGER"].includes(role)`), but `dashboard/page.tsx` currently routes MANAGER to `null` — fix needed
- `weakCriteria` JSON shape today: `{ id: string; label: string; score: number; coachingNote: string }[]` — Task 1 adds `section: "A"|"B"|"C"` to each item

---

## File Map

| File | Action |
|------|--------|
| `app/api/scores/peer/route.ts` | CREATE |
| `app/api/scores/compare/route.ts` | CREATE |
| `app/components/shared/PeerComparisonView.tsx` | CREATE |
| `app/components/shared/ManagementComparisonView.tsx` | CREATE |
| `app/components/dashboards/AgentDashboard.tsx` | MODIFY — add nav item + tab |
| `app/components/dashboards/TeamLeaderDashboard.tsx` | MODIFY — add nav item + tab |
| `app/components/dashboards/AdminDashboard.tsx` | MODIFY — add nav item + tab |
| `app/dashboard/page.tsx` | MODIFY — add MANAGER → AdminDashboard routing |

---

## Task 1: Prompt güncellemesi — `section` alanı ekle

**Files:**
- Modify: active FIRST_CALL and SECOND_CALL prompts in DB (via `pg` Node script)

- [ ] **Step 1: Write a Node script to update both active prompts**

Create a temporary file `/tmp/update-prompts-section.js`:

```javascript
const { Client } = require('/Users/sorcerer/sdr-analyzer/node_modules/pg');

const DB = 'postgresql://postgres.tctaxydfncrzligmbjri:LdTuYZU0kwyD0wY8@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const OLD_SNIPPET = `{"id":"[KRİTER_ID]","label":"[KRİTER_ADI]","score":[PUAN],"coachingNote":"[KOÇLUK_NOTU]"}`;
const NEW_SNIPPET = `{"id":"[KRİTER_ID]","label":"[KRİTER_ADI]","score":[PUAN],"section":"[BÖLÜM]","coachingNote":"[KOÇLUK_NOTU]"}`;

const OLD_RULE = `- weakCriteria: Skoru 80'in altındaki kriterlerin en düşük puanlı en fazla 3 tanesi; tüm kriterler 80+ ise boş dizi []`;
const NEW_RULE = `- weakCriteria: Skoru 80'in altındaki kriterlerin en düşük puanlı en fazla 3 tanesi; tüm kriterler 80+ ise boş dizi []\n- section: kriterin ait olduğu bölüm — "A", "B" veya "C" değerlerinden biri`;

async function run() {
  const client = new Client({ connectionString: DB });
  await client.connect();

  const res = await client.query(
    `SELECT id, "callType", content FROM "Prompt" WHERE "isActive" = true AND "callType" IN ('FIRST_CALL', 'SECOND_CALL')`
  );

  for (const row of res.rows) {
    let updated = row.content
      .replace(OLD_SNIPPET, NEW_SNIPPET)
      .replace(OLD_RULE, NEW_RULE);

    if (updated === row.content) {
      console.log(`WARN: ${row.callType} — no change made, check snippet match`);
      continue;
    }

    await client.query(`UPDATE "Prompt" SET content = $1, "updatedAt" = NOW() WHERE id = $2`, [updated, row.id]);
    console.log(`OK: ${row.callType} prompt updated`);
  }

  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 2: Run the script**

```bash
node /tmp/update-prompts-section.js
```

Expected output:
```
OK: FIRST_CALL prompt updated
OK: SECOND_CALL prompt updated
```

- [ ] **Step 3: Verify the update**

```bash
node -e "
const { Client } = require('/Users/sorcerer/sdr-analyzer/node_modules/pg');
const c = new Client({ connectionString: 'postgresql://postgres.tctaxydfncrzligmbjri:LdTuYZU0kwyD0wY8@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
c.connect().then(async () => {
  const r = await c.query('SELECT \"callType\", substring(content, position(\'section\' in content)-5, 80) as snip FROM \"Prompt\" WHERE \"isActive\" = true AND \"callType\" IN (\'FIRST_CALL\',\'SECOND_CALL\')');
  r.rows.forEach(row => console.log(row.callType + ':', row.snip));
  await c.end();
});
"
```

Expected: both rows show `"section":"[BÖLÜM]"` in the snippet.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add section field to weakCriteria prompt template"
```

---

## Task 2: `/api/scores/peer/route.ts`

**Files:**
- Create: `app/api/scores/peer/route.ts`

- [ ] **Step 1: Write a manual test to verify the API shape before implementing**

```bash
# After the route is implemented, we'll curl it. For now verify the directory exists:
ls app/api/scores/
```

Expected: `route.ts`, `trend/` visible.

- [ ] **Step 2: Create the route file**

Create `app/api/scores/peer/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function sectionAvgFromEvals(
  evals: { sectionScores: unknown }[]
): { A: number; B: number; C: number } | null {
  const withSections = evals.filter(e => e.sectionScores);
  if (withSections.length === 0) return null;
  const totals = withSections.reduce(
    (acc, e) => {
      const ss = e.sectionScores as { A: number; B: number; C: number };
      return {
        A: acc.A + (ss?.A ?? 0),
        B: acc.B + (ss?.B ?? 0),
        C: acc.C + (ss?.C ?? 0),
      };
    },
    { A: 0, B: 0, C: 0 }
  );
  const n = withSections.length;
  return {
    A: Math.round(totals.A / n),
    B: Math.round(totals.B / n),
    C: Math.round(totals.C / n),
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!["AGENT", "TEAM_LEADER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // Determine team members
  let teamMembers: { id: string }[] = [];
  if (user.role === "AGENT" && user.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: user.teamId },
      select: { members: { select: { id: true } } },
    });
    teamMembers = team?.members ?? [];
  } else if (user.role === "TEAM_LEADER") {
    const team = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { members: { select: { id: true } } },
    });
    teamMembers = team?.members ?? [];
  }

  const hasTeam = teamMembers.length > 0;

  // My evaluations
  const myEvals = await prisma.evaluation.findMany({
    where: { agentId: user.id },
    select: { score: true, sectionScores: true, weakCriteria: true },
  });

  const mineOverallAvg = avg(myEvals.map(e => e.score));
  const mineSectionAvg = sectionAvgFromEvals(myEvals);
  const mineCallCount = myEvals.length;

  // Build my criteria map (only items with section field, count >= 2)
  const myCriteriaMap: Record<
    string,
    { label: string; section: string; totalScore: number; count: number }
  > = {};
  myEvals.forEach(e => {
    if (!Array.isArray(e.weakCriteria)) return;
    (
      e.weakCriteria as Array<{
        id: string;
        label: string;
        score: number;
        section?: string;
      }>
    ).forEach(c => {
      if (!c.section) return;
      if (!myCriteriaMap[c.id]) {
        myCriteriaMap[c.id] = {
          label: c.label,
          section: c.section,
          totalScore: 0,
          count: 0,
        };
      }
      myCriteriaMap[c.id].totalScore += c.score;
      myCriteriaMap[c.id].count += 1;
    });
  });

  let teamData: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
  } | null = null;

  let criteriaBreakdown: Array<{
    id: string;
    label: string;
    section: string;
    mine: number;
    teamAvg: number;
    delta: number;
  }> = [];

  if (hasTeam) {
    const teamIds = teamMembers.map(m => m.id);

    const allTeamEvals = await prisma.evaluation.findMany({
      where: { agentId: { in: teamIds } },
      select: { score: true, sectionScores: true, weakCriteria: true },
    });

    const teamCriteriaMap: Record<
      string,
      { totalScore: number; count: number }
    > = {};
    allTeamEvals.forEach(e => {
      if (!Array.isArray(e.weakCriteria)) return;
      (
        e.weakCriteria as Array<{
          id: string;
          score: number;
          section?: string;
        }>
      ).forEach(c => {
        if (!c.section) return;
        if (!teamCriteriaMap[c.id]) teamCriteriaMap[c.id] = { totalScore: 0, count: 0 };
        teamCriteriaMap[c.id].totalScore += c.score;
        teamCriteriaMap[c.id].count += 1;
      });
    });

    criteriaBreakdown = Object.entries(myCriteriaMap)
      .filter(([, v]) => v.count >= 2)
      .map(([id, v]) => {
        const mineAvg = Math.round(v.totalScore / v.count);
        const teamEntry = teamCriteriaMap[id];
        const teamAvg = teamEntry
          ? Math.round(teamEntry.totalScore / teamEntry.count)
          : mineAvg;
        return {
          id,
          label: v.label,
          section: v.section,
          mine: mineAvg,
          teamAvg,
          delta: mineAvg - teamAvg,
        };
      });

    teamData = {
      overallAvg: avg(allTeamEvals.map(e => e.score)),
      sectionAvg: sectionAvgFromEvals(allTeamEvals),
      callCountAvg: Math.round(allTeamEvals.length / teamIds.length),
    };
  }

  return NextResponse.json({
    mine: {
      overallAvg: mineOverallAvg,
      sectionAvg: mineSectionAvg,
      callCount: mineCallCount,
      criteriaBreakdown,
    },
    team: teamData,
    teamSize: teamMembers.length,
    hasTeam,
  });
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `app/api/scores/peer/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/scores/peer/route.ts
git commit -m "feat: add /api/scores/peer endpoint for personal comparison"
```

---

## Task 3: `/api/scores/compare/route.ts`

**Files:**
- Create: `app/api/scores/compare/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/scores/compare/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function sectionAvgFromEvals(
  evals: { sectionScores: unknown }[]
): { A: number; B: number; C: number } | null {
  const withSections = evals.filter(e => e.sectionScores);
  if (withSections.length === 0) return null;
  const totals = withSections.reduce(
    (acc, e) => {
      const ss = e.sectionScores as { A: number; B: number; C: number };
      return {
        A: acc.A + (ss?.A ?? 0),
        B: acc.B + (ss?.B ?? 0),
        C: acc.C + (ss?.C ?? 0),
      };
    },
    { A: 0, B: 0, C: 0 }
  );
  const n = withSections.length;
  return {
    A: Math.round(totals.A / n),
    B: Math.round(totals.B / n),
    C: Math.round(totals.C / n),
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const teamIdsParam = req.nextUrl.searchParams.get("teamIds") || "";
  const agentIdsParam = req.nextUrl.searchParams.get("agentIds") || "";

  // All teams for selector
  const allTeams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      members: { select: { id: true } },
    },
  });
  const teams = allTeams.map(t => ({
    id: t.id,
    name: t.name,
    memberCount: t.members.length,
  }));

  const targetTeamIds: string[] =
    teamIdsParam
      ? teamIdsParam.split(",").filter(Boolean)
      : allTeams.map(t => t.id);

  let agents = await prisma.user.findMany({
    where: {
      role: "AGENT",
      teamId: { in: targetTeamIds },
    },
    select: {
      id: true,
      name: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });

  if (agentIdsParam) {
    const agentIdFilter = agentIdsParam.split(",").filter(Boolean);
    agents = agents.filter(a => agentIdFilter.includes(a.id));
  }

  const agentResults = await Promise.all(
    agents.map(async a => {
      const evals = await prisma.evaluation.findMany({
        where: { agentId: a.id },
        select: { score: true, sectionScores: true },
      });
      return {
        id: a.id,
        name: a.name,
        teamId: a.teamId ?? "",
        teamName: a.team?.name ?? "Takımsız",
        overallAvg: avg(evals.map(e => e.score)),
        sectionAvg: sectionAvgFromEvals(evals),
        callCount: evals.length,
      };
    })
  );

  agentResults.sort((a, b) => b.overallAvg - a.overallAvg);

  const aggregateOverallAvg = avg(agentResults.map(a => a.overallAvg));
  const callCountAvg =
    agentResults.length > 0
      ? Math.round(
          agentResults.reduce((s, a) => s + a.callCount, 0) /
            agentResults.length
        )
      : 0;

  const agentsWithSections = agentResults.filter(a => a.sectionAvg);
  const aggregateSectionAvg =
    agentsWithSections.length > 0
      ? {
          A: Math.round(
            agentsWithSections.reduce((s, a) => s + a.sectionAvg!.A, 0) /
              agentsWithSections.length
          ),
          B: Math.round(
            agentsWithSections.reduce((s, a) => s + a.sectionAvg!.B, 0) /
              agentsWithSections.length
          ),
          C: Math.round(
            agentsWithSections.reduce((s, a) => s + a.sectionAvg!.C, 0) /
              agentsWithSections.length
          ),
        }
      : null;

  return NextResponse.json({
    agents: agentResults,
    aggregate: {
      overallAvg: aggregateOverallAvg,
      sectionAvg: aggregateSectionAvg,
      callCountAvg,
      agentCount: agentResults.length,
    },
    teams,
  });
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `app/api/scores/compare/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/scores/compare/route.ts
git commit -m "feat: add /api/scores/compare endpoint for management comparison"
```

---

## Task 4: `PeerComparisonView.tsx`

**Files:**
- Create: `app/components/shared/PeerComparisonView.tsx`

- [ ] **Step 1: Create the component**

Create `app/components/shared/PeerComparisonView.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

interface CriterionBreakdown {
  id: string;
  label: string;
  section: string;
  mine: number;
  teamAvg: number;
  delta: number;
}

interface PeerData {
  mine: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCount: number;
    criteriaBreakdown: CriterionBreakdown[];
  };
  team: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
  } | null;
  teamSize: number;
  hasTeam: boolean;
}

const SECTION_CONFIG = {
  A: { label: "A · Giriş & Profilleme", color: "#818cf8" },
  B: { label: "B · Çözüm & Otorite", color: "#facc15" },
  C: { label: "C · Kapanış & Köprü", color: "#f87171" },
} as const;

function DeltaBadge({ delta }: { delta: number }) {
  const color =
    delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : "#94a3b8";
  const bg =
    delta > 0
      ? "rgba(74,222,128,0.1)"
      : delta < 0
      ? "rgba(248,113,113,0.1)"
      : "rgba(148,163,184,0.1)";
  return (
    <span
      style={{
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 20,
      }}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

function RefBar({
  mine,
  teamAvg,
  color,
}: {
  mine: number;
  teamAvg: number;
  color: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        height: 8,
        background: "#1e2535",
        borderRadius: 99,
        overflow: "visible",
      }}
    >
      <div
        style={{
          width: `${Math.min(mine, 100)}%`,
          height: "100%",
          background: color,
          borderRadius: 99,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: -3,
          left: `${Math.min(teamAvg, 100)}%`,
          width: 2,
          height: 14,
          background: "#475569",
          borderRadius: 2,
          transform: "translateX(-50%)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 8,
            color: "#475569",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}
        >
          ort.
        </span>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  mine,
  team,
  criteria,
}: {
  section: "A" | "B" | "C";
  mine: number;
  team: number | null;
  criteria: CriterionBreakdown[];
}) {
  const [open, setOpen] = useState(false);
  const cfg = SECTION_CONFIG[section];
  const delta = team !== null ? mine - team : null;

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        background: "#131723",
        border: "1px solid #1e2535",
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <div style={{ padding: "14px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>
              {cfg.label}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "#334155",
                display: "inline-block",
                transform: open ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            >
              ▾
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>
              %{mine}
            </span>
            {team !== null && (
              <>
                <span style={{ fontSize: 11, color: "#334155" }}>/</span>
                <span style={{ fontSize: 12, color: "#475569" }}>
                  %{team} ort.
                </span>
              </>
            )}
            {delta !== null && <DeltaBadge delta={delta} />}
          </div>
        </div>
        <RefBar mine={mine} teamAvg={team ?? 0} color={cfg.color} />
      </div>

      {open && (
        <div
          style={{
            borderTop: "1px solid #1e2535",
            padding: "12px 16px 14px",
            background: "#0f1420",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: "#334155",
              marginBottom: 10,
            }}
          >
            Kriter bazlı karşılaştırma
          </div>
          {criteria.length === 0 ? (
            <p style={{ fontSize: 11, color: "#475569" }}>
              Bu bölüm için henüz kriter verisi yok.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {criteria.map(c => (
                <div key={c.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 5,
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      {c.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#cbd5e1",
                        }}
                      >
                        %{c.mine}
                      </span>
                      <span style={{ fontSize: 10, color: "#475569" }}>
                        / %{c.teamAvg} ort.
                      </span>
                      <DeltaBadge delta={c.delta} />
                    </div>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 5,
                      background: "#1e2535",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(c.mine, 100)}%`,
                        height: "100%",
                        background: cfg.color + "88",
                        borderRadius: 99,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        left: `${Math.min(c.teamAvg, 100)}%`,
                        width: 2,
                        height: 9,
                        background: "#475569",
                        borderRadius: 2,
                        transform: "translateX(-50%)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PeerComparisonView({ agentId }: { agentId: string }) {
  const [data, setData] = useState<PeerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scores/peer")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [agentId]);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { mine, team, hasTeam } = data;
  const overallDelta = team ? mine.overallAvg - team.overallAvg : null;

  const criteriaForSection = (s: "A" | "B" | "C") =>
    mine.criteriaBreakdown.filter(c => c.section === s);

  const callCountDelta = team ? mine.callCount - team.callCountAvg : null;
  const callBarMine =
    team && team.callCountAvg > 0
      ? Math.min((mine.callCount / (team.callCountAvg * 2)) * 100, 100)
      : 50;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-headline text-3xl font-bold text-white">
          Nasıl Gidiyorum?
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {hasTeam
            ? "Takım ortalamasıyla karşılaştırma"
            : "Henüz bir takıma atanmamışsın — kendi skorların gösteriliyor."}
        </p>
      </div>

      {/* Summary banner */}
      <div className="bg-surface-container rounded-3xl p-6 flex items-center gap-5">
        <div
          style={{ fontSize: 48, fontWeight: 900, color: "#f1f5f9", lineHeight: 1 }}
        >
          %{mine.overallAvg}
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              fontWeight: 600,
              letterSpacing: "0.5px",
              marginBottom: 4,
            }}
          >
            GENEL SKORUN
          </div>
          {overallDelta !== null && <DeltaBadge delta={overallDelta} />}
          {team && (
            <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
              Takım ortalaması{" "}
              <span style={{ color: "#94a3b8" }}>%{team.overallAvg}</span>
            </div>
          )}
        </div>
      </div>

      {/* Section cards */}
      {mine.sectionAvg && (
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#334155",
              marginBottom: 8,
            }}
          >
            Bölüm Skorları — detay için tıkla
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(["A", "B", "C"] as const).map(s => (
              <SectionCard
                key={s}
                section={s}
                mine={mine.sectionAvg![s]}
                team={team?.sectionAvg?.[s] ?? null}
                criteria={criteriaForSection(s)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Call count */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "#334155",
            marginBottom: 8,
          }}
        >
          Değerlendirme Sayısı
        </div>
        <div className="bg-surface-container rounded-2xl p-5">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>
              Toplam değerlendirilen çağrı
            </span>
            {callCountDelta !== null && <DeltaBadge delta={callCountDelta} />}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 16,
              marginBottom: 10,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: "#22d3ee",
                }}
              >
                {mine.callCount}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#475569",
                  marginTop: 3,
                  fontWeight: 600,
                  letterSpacing: "0.3px",
                }}
              >
                SEN
              </div>
            </div>
            {team && (
              <>
                <div
                  style={{ width: 1, height: 28, background: "#1e2535" }}
                />
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1,
                      color: "#475569",
                    }}
                  >
                    {team.callCountAvg}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#475569",
                      marginTop: 3,
                      fontWeight: 600,
                      letterSpacing: "0.3px",
                    }}
                  >
                    TAKIM ORT.
                  </div>
                </div>
              </>
            )}
          </div>
          {team && <RefBar mine={callBarMine} teamAvg={50} color="#22d3ee" />}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `PeerComparisonView.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/PeerComparisonView.tsx
git commit -m "feat: add PeerComparisonView component"
```

---

## Task 5: `ManagementComparisonView.tsx`

**Files:**
- Create: `app/components/shared/ManagementComparisonView.tsx`

- [ ] **Step 1: Create the component**

Create `app/components/shared/ManagementComparisonView.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

interface AgentResult {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  overallAvg: number;
  sectionAvg: { A: number; B: number; C: number } | null;
  callCount: number;
}

interface CompareData {
  agents: AgentResult[];
  aggregate: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
    agentCount: number;
  };
  teams: Array<{ id: string; name: string; memberCount: number }>;
}

function scoreColor(s: number): string {
  return s >= 85
    ? "#4ade80"
    : s >= 70
    ? "#818cf8"
    : s >= 55
    ? "#facc15"
    : "#f87171";
}

export default function ManagementComparisonView() {
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const fetchData = (teamIds: string[]) => {
    setLoading(true);
    const params =
      teamIds.length > 0 ? `?teamIds=${teamIds.join(",")}` : "";
    fetch(`/api/scores/compare${params}`)
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData([]);
  }, []);

  const toggleTeam = (id: string) => {
    const next = selectedTeamIds.includes(id)
      ? selectedTeamIds.filter(t => t !== id)
      : [...selectedTeamIds, id];
    setSelectedTeamIds(next);
    fetchData(next);
  };

  const selectAll = () => {
    setSelectedTeamIds([]);
    fetchData([]);
  };

  const isAllSelected = selectedTeamIds.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold text-white">
          Karşılaştırma
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Takım ve danışman performans karşılaştırması
        </p>
      </div>

      {/* Team filter */}
      {data && (
        <div className="bg-surface-container rounded-2xl p-4">
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "#334155",
              marginBottom: 10,
            }}
          >
            Takım Filtresi
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              onClick={selectAll}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: isAllSelected ? "#6c63ff22" : "#1e2535",
                color: isAllSelected ? "#818cf8" : "#64748b",
                border: `1px solid ${isAllSelected ? "#6c63ff44" : "#1e2535"}`,
              }}
            >
              Tüm Takımlar
            </button>
            {data.teams.map(t => {
              const active = selectedTeamIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggleTeam(t.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: active ? "#6c63ff22" : "#1e2535",
                    color: active ? "#818cf8" : "#64748b",
                    border: `1px solid ${active ? "#6c63ff44" : "#1e2535"}`,
                  }}
                >
                  {t.name}{" "}
                  <span style={{ opacity: 0.5 }}>({t.memberCount})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* Aggregate cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "GENEL ORT.",
                value: `%${data.aggregate.overallAvg}`,
                color: "#818cf8",
              },
              {
                label: "DANIŞMAN SAYISI",
                value: String(data.aggregate.agentCount),
                color: "#22d3ee",
              },
              {
                label: "ORT. DEĞERLENDİRME",
                value: String(data.aggregate.callCountAvg),
                color: "#4ade80",
              },
            ].map(card => (
              <div
                key={card.label}
                className="bg-surface-container rounded-2xl p-5 text-center"
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "#334155",
                    marginBottom: 8,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: card.color,
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Agent list */}
          {data.agents.length === 0 ? (
            <div className="bg-surface-container rounded-2xl p-10 text-center">
              <p style={{ color: "#475569", fontSize: 14 }}>
                Bu takımda henüz danışman bulunmuyor.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.agents.map((agent, i) => (
                <div
                  key={agent.id}
                  style={{
                    background: "#131723",
                    border: "1px solid #1e2535",
                    borderRadius: 14,
                    padding: "14px 16px",
                    display: "grid",
                    gridTemplateColumns: "32px 160px 1fr 64px 48px 48px 48px",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#334155",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    #{i + 1}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: "#1e2535",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#cbd5e1",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agent.name}
                      </div>
                      <div style={{ fontSize: 10, color: "#475569" }}>
                        {agent.teamName}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      position: "relative",
                      height: 6,
                      background: "#1e2535",
                      borderRadius: 99,
                    }}
                  >
                    <div
                      style={{
                        width: `${agent.overallAvg}%`,
                        height: "100%",
                        background: scoreColor(agent.overallAvg),
                        borderRadius: 99,
                      }}
                    />
                    {data.aggregate.overallAvg > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: -2,
                          left: `${data.aggregate.overallAvg}%`,
                          width: 2,
                          height: 10,
                          background: "#475569",
                          borderRadius: 2,
                          transform: "translateX(-50%)",
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 800,
                      color: scoreColor(agent.overallAvg),
                    }}
                  >
                    %{agent.overallAvg}
                  </div>
                  {(["A", "B", "C"] as const).map(s => (
                    <div key={s} style={{ textAlign: "center" }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: "#334155",
                          fontWeight: 700,
                          marginBottom: 2,
                        }}
                      >
                        {s}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                        }}
                      >
                        {agent.sectionAvg
                          ? `%${agent.sectionAvg[s]}`
                          : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ManagementComparisonView.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/shared/ManagementComparisonView.tsx
git commit -m "feat: add ManagementComparisonView component"
```

---

## Task 6: AgentDashboard — tab entegrasyonu

**Files:**
- Modify: `app/components/dashboards/AgentDashboard.tsx`

- [ ] **Step 1: Add import at the top of the file**

In `app/components/dashboards/AgentDashboard.tsx`, after the existing imports (around line 12), add:

```typescript
import PeerComparisonView from "@/app/components/shared/PeerComparisonView";
```

- [ ] **Step 2: Add nav item**

Find the `navItems` array (around line 107):

```typescript
  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_myCalls },
    { key: "scores", icon: "star", label: t.nav_scores },
    { key: "reports", icon: "assessment", label: t.nav_myReports },
    { key: "feedback", icon: "feedback", label: fb.title },
  ];
```

Replace with:

```typescript
  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_myCalls },
    { key: "scores", icon: "star", label: t.nav_scores },
    { key: "reports", icon: "assessment", label: t.nav_myReports },
    { key: "peer", icon: "compare_arrows", label: "Nasıl Gidiyorum?" },
    { key: "feedback", icon: "feedback", label: fb.title },
  ];
```

- [ ] **Step 3: Add tab render**

Find the `{activeTab === "feedback" &&` block (around line 231). Just before it, add:

```tsx
          {activeTab === "peer" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <PeerComparisonView agentId={user.id} />
            </motion.div>
          )}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/dashboards/AgentDashboard.tsx
git commit -m "feat: add Nasıl Gidiyorum? tab to AgentDashboard"
```

---

## Task 7: TeamLeaderDashboard — tab entegrasyonu

**Files:**
- Modify: `app/components/dashboards/TeamLeaderDashboard.tsx`

- [ ] **Step 1: Add import**

In `app/components/dashboards/TeamLeaderDashboard.tsx`, after the existing imports (around line 14), add:

```typescript
import PeerComparisonView from "@/app/components/shared/PeerComparisonView";
```

- [ ] **Step 2: Add nav item**

Find the `navItems` array (around line 129):

```typescript
  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_myCalls },
    { key: "scores", icon: "star", label: t.nav_scores },
    { key: "reports", icon: "assessment", label: t.nav_myReports },
    { key: "team", icon: "group", label: t.nav_myTeam },
    { key: "feedback", icon: "feedback", label: fb.title },
  ];
```

Replace with:

```typescript
  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_myCalls },
    { key: "scores", icon: "star", label: t.nav_scores },
    { key: "reports", icon: "assessment", label: t.nav_myReports },
    { key: "team", icon: "group", label: t.nav_myTeam },
    { key: "peer", icon: "compare_arrows", label: "Nasıl Gidiyorum?" },
    { key: "feedback", icon: "feedback", label: fb.title },
  ];
```

- [ ] **Step 3: Add tab render**

Find `{activeTab === "feedback" &&` in `TeamLeaderDashboard.tsx` (around line 391). Just before it, add:

```tsx
          {activeTab === "peer" && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <PeerComparisonView agentId={user.id} />
            </motion.div>
          )}
```

- [ ] **Step 4: Check TypeScript compiles**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/dashboards/TeamLeaderDashboard.tsx
git commit -m "feat: add Nasıl Gidiyorum? tab to TeamLeaderDashboard"
```

---

## Task 8: AdminDashboard + dashboard/page.tsx — Manager fix & Karşılaştırma tab

**Files:**
- Modify: `app/components/dashboards/AdminDashboard.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add import to AdminDashboard**

In `app/components/dashboards/AdminDashboard.tsx`, after the existing imports, add:

```typescript
import ManagementComparisonView from "@/app/components/shared/ManagementComparisonView";
```

- [ ] **Step 2: Add nav item to AdminDashboard**

Find the `navItems` array (around line 312):

```typescript
  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_calls },
    { key: "status", icon: "analytics", label: t.nav_status },
    { key: "reports", icon: "assessment", label: t.nav_reports },
    { key: "scores", icon: "star", label: t.nav_scores },
  ];
```

Replace with:

```typescript
  const navItems = [
    { key: "home", icon: "home", label: t.nav_home },
    { key: "calls", icon: "call", label: t.nav_calls },
    { key: "status", icon: "analytics", label: t.nav_status },
    { key: "reports", icon: "assessment", label: t.nav_reports },
    { key: "scores", icon: "star", label: t.nav_scores },
    { key: "compare", icon: "compare_arrows", label: "Karşılaştırma" },
  ];
```

- [ ] **Step 3: Add tab render to AdminDashboard**

Find `{activeTab === "batch" && isAdmin && (` (around line 1076). Just before it, add:

```tsx
          {activeTab === "compare" && (
            <ManagementComparisonView />
          )}
```

- [ ] **Step 4: Fix MANAGER routing in dashboard/page.tsx**

In `app/dashboard/page.tsx`, find:

```typescript
  if (user.role === "ADMIN")       return <AdminDashboard user={user} initialTab={initialTab} />;
  if (user.role === "AGENT")       return <AgentDashboard {...sharedProps} />;
  if (user.role === "TEAM_LEADER") return <TeamLeaderDashboard {...sharedProps} />;

  return null;
```

Replace with:

```typescript
  if (user.role === "ADMIN" || user.role === "MANAGER") return <AdminDashboard user={user} initialTab={initialTab} />;
  if (user.role === "AGENT")       return <AgentDashboard {...sharedProps} />;
  if (user.role === "TEAM_LEADER") return <TeamLeaderDashboard {...sharedProps} />;

  return null;
```

- [ ] **Step 5: Check TypeScript compiles**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Verify dev server runs without errors**

```bash
cd /Users/sorcerer/sdr-analyzer && npx next build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 7: Commit**

```bash
git add app/components/dashboards/AdminDashboard.tsx app/dashboard/page.tsx
git commit -m "feat: add Karşılaştırma tab to AdminDashboard, fix MANAGER routing"
```
