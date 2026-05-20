# Criteria Trend & Gelişim Takibi Design

**Date:** 2026-05-20  
**Status:** Approved

## Problem

The trend chart only shows section-level scores (A/B/C) over time. Managers and team leaders cannot see which specific coaching criteria a consultant fails week-over-week, making it hard to spot chronic issues and take targeted action.

## Goal

Add per-criterion trend visibility to the dashboard:
1. A **"Kriterler" tab** inside TrendChart showing a heatmap (criteria × weeks grid)
2. A **"Gelişim Takibi" card** below TrendChart showing a weekly chip list
3. Proper access control so TEAM_LEADER cannot query arbitrary agent IDs

---

## Architecture

All changes live in three files:

| File | Change |
|------|--------|
| `app/api/scores/trend/route.ts` | Add weekly weak criteria aggregation + TEAM_LEADER access check |
| `app/components/shared/TrendChart.tsx` | Add "Kriterler" tab (heatmap + weekly list) and "Gelişim Takibi" card |
| `prisma/schema.prisma` | No changes — `weakCriteria` JSON field already exists on Evaluation |

---

## Part 1: API — `/api/scores/trend`

### New query field

```typescript
select: { callDate: true, sectionScores: true, weakCriteria: true }
```

### Weekly aggregation logic

For each week bucket, collect all `weakCriteria` items from evaluations in that week:

```typescript
type WeakCriterionItem = { id: string; label: string; score: number; coachingNote: string };

// Per week: count occurrences of each criterion id, accumulate scores
weekBucket.criteriaMap: Map<string, { label: string; count: number; scoreSum: number }>
```

### New response fields

```typescript
weakCriteriaTrend: Array<{
  week: string;       // "H1", "H2"...
  date: string;       // "12–18 May"
  topCriteria: Array<{
    id: string;
    label: string;
    count: number;     // times flagged this week
    avgScore: number;  // average score when flagged
  }>;                 // sorted by count desc, max 8
}>

topCriteriaOverall: Array<{
  id: string;
  label: string;
  totalCount: number;
}>
// All criteria that appeared across any week, sorted by totalCount desc, max 8
// Used to define heatmap row order
```

### Access control additions

```typescript
if (user.role === "AGENT" && agentId !== user.id) {
  return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
}
if (user.role === "TEAM_LEADER" && agentId !== user.id) {
  const teamMember = await prisma.user.findFirst({
    where: { id: agentId, team: { leaderId: user.id } },
  });
  if (!teamMember) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
}
// ADMIN and MANAGER: no restriction
```

---

## Part 2: TrendChart Component

### Interface changes

```typescript
interface TrendData {
  weeks: TrendWeek[];
  trendIndicators: { periodDrop: DropIndicator | null; lastWeekDrop: DropIndicator | null };
  hasEnoughData: boolean;
  weakCriteriaTrend: WeekCriteriaData[];     // NEW
  topCriteriaOverall: TopCriterion[];         // NEW
}

interface WeekCriteriaData {
  week: string;
  date: string;
  topCriteria: Array<{ id: string; label: string; count: number; avgScore: number }>;
}

interface TopCriterion {
  id: string;
  label: string;
  totalCount: number;
}
```

### New state

```typescript
const [view, setView] = useState<"sections" | "criteria">("sections");
```

### Tab toggle (in header)

Alongside the existing range buttons, add a view toggle:

```
[ Kategoriler ]  [ Kriterler ]
```

### "Kriterler" view layout

When `view === "criteria"` and `data.topCriteriaOverall.length > 0`:

```
┌─────────────────────────────────────────────────────┐
│  [Isı Haritası]                [Haftalık Liste]     │
│                                                     │
│  Kriter           H1  H2  H3  H4    12–18 May      │
│  İtiraz Yönetimi  ■3  ■5  ■2  ■4    İtiraz ×5 Kap ×3│
│  Kapanış          ■2  ■0  ■3  ■2    5–11 May        │
│  Empati           ■0  ■1  ■2  ■3    İtiraz ×3        │
└─────────────────────────────────────────────────────┘
```

**Heatmap cell colors** (by count):
- 0 → `rgba(255,255,255,.04)` with dim border
- 1 → `#7f1d1d`
- 2 → `#991b1b`
- 3+ → `#b91c1c`

**Weekly chip colors** (by count):
- count ≥ 3 → red (`#f87171`, `rgba(239,68,68,.2)`)
- count 2 → orange (`#fb923c`, `rgba(251,146,60,.15)`)
- count 1 → yellow (`#fbbf24`, `rgba(251,191,36,.1)`)

Max 5 chips per week. Max 8 criteria rows.

Empty state: "Bu dönemde zayıf kriter verisi bulunmuyor." centered in the area.

### "Gelişim Takibi" card (always below chart)

Rendered as a separate card below the tabs area when `data.weakCriteriaTrend.length >= 2`.

```
🔥 Gelişim Takibi
─────────────────────────────────────────────
12–18 May   [İtiraz Yönetimi ×5] [Kapanış ×3] [Empati ×2]
5–11 May    [İtiraz Yönetimi ×4] [Fiyat Sunumu ×2]
28 Apr–4    [Kapanış ×3] [İtiraz Yönetimi ×2]
```

- Shows all weeks in the selected range, newest first (API returns ascending — component renders `.slice().reverse()`)
- Each chip: `label ×count`, colored by count (same rules as above)
- Max 5 chips per row; if more, show "+N daha"
- Not shown if fewer than 2 weeks of data

---

## Part 3: Access Model

All roles can see the criteria trend for any agent they are already authorized to view. The authorization is enforced at the API level:

| Role | Can query agentId |
|------|------------------|
| ADMIN | Any |
| MANAGER | Any |
| TEAM_LEADER | Own ID or team member ID |
| AGENT | Own ID only |

No UI changes needed — `ScoreView` already passes the correct `agentId` per role.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `weakCriteria` is null on an evaluation | Skip that evaluation's criteria — section scores still counted |
| No criteria data for selected range | "Kriterler" tab shows empty state message; "Gelişim Takibi" card hidden |
| TEAM_LEADER queries outside their team | 403 from API |
| Fewer than 2 weeks | "Gelişim Takibi" card not rendered; "Kriterler" tab shows whatever data exists |

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/scores/trend/route.ts` | Add `weakCriteria` to query, aggregate by week, add TEAM_LEADER access check, extend response |
| `app/components/shared/TrendChart.tsx` | Add view state, Kriterler tab with heatmap + chip list, Gelişim Takibi card |
