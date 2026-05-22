---
name: coaching-evaluation-tracking-dashboard
description: Coaching & Evaluation Tracking dashboard for Admin and Manager — shows which agents read their evaluations and which TLs completed coaching sessions, with date range filter
metadata:
  type: project
---

# Coaching & Evaluation Tracking Dashboard

**Date:** 2026-05-22  
**Status:** Approved  
**Roles:** Admin, Manager only (Team Leaders intentionally excluded — monitoring tool)

## Overview

A new dashboard under the Reports sidebar group that lets Admin and Manager track:
1. Which agents have read their evaluations (`agentRead` / `agentReadAt`)
2. Which team leaders have completed coaching sessions (`coachingDone` / `coachingDoneAt` / `coachingNotes` / `coachingByName`)

The view has a date range filter, summary cards at the top, and an accordion table below.

---

## 1. API

### `GET /api/reports/coaching-tracking`

**Auth:** ADMIN or MANAGER only → 403 for all other roles  
**Query params:** `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD)

**Response shape:**

```ts
{
  summary: {
    totalEvaluations: number;
    agentReadCount: number;
    coachingDoneCount: number;
  };
  agents: Array<{
    agentId: string;
    agentName: string;
    teamName: string | null;
    totalEvals: number;
    readCount: number;
    coachingDoneCount: number;
    evaluations: Array<{
      id: string;
      customerName: string;
      callDate: string;       // ISO string
      score: number;
      agentRead: boolean;
      agentReadAt: string | null;
      coachingDone: boolean;
      coachingDoneAt: string | null;
      coachingNotes: string | null;
      coachingByName: string | null;
    }>;
  }>;
}
```

**Prisma query strategy:**
- `prisma.evaluation.findMany` with date filter on `createdAt`
- `select` excludes `transcript` and `report` (large fields — not needed here)
- Include `agent { name, team { name } }`
- Group by `agentId` in application layer after fetch

---

## 2. Frontend Component

**File:** `app/components/shared/CoachingTrackingView.tsx`

### Top section — Summary cards (3 cards)

| Card | Value |
|------|-------|
| Toplam Değerlendirme | `summary.totalEvaluations` |
| Okundu | `summary.agentReadCount / summary.totalEvaluations` — with percentage bar |
| Coaching Tamamlandı | `summary.coachingDoneCount / summary.totalEvaluations` — with percentage bar |

Cards use the same glass-bg / border / accent styling as the rest of the app.

### Date range picker

Uses existing `DateRangePicker` component with `onApply` triggering API refetch.  
Default: no filter (all time), but user can apply start/end dates.

### Bottom section — Accordion table

**Collapsed row (per agent):**
```
▶  [Agent Name]  |  [Team Name]  |  [N] değerlendirme  |  [X/N] okundu  |  [Y/N] coaching
```

Clicking toggles expansion. Chevron rotates 90°.

**Expanded rows (per evaluation under that agent):**

| Müşteri | Tarih | Skor | Okundu | Coaching |
|---------|-------|------|--------|----------|
| John D. | 15 May 2026 | 78 | ✓ 16 May | ✗ — |
| Jane S. | 14 May 2026 | 65 | ✗ — | ✓ 15 May · "İlk 30 saniye..." |

- **Okundu:** green checkmark + `agentReadAt` date if true; red ✗ if false
- **Coaching:** green checkmark + `coachingDoneAt` date + first ~30 chars of `coachingNotes` if true; red ✗ if false  
  Full note visible on hover (CSS `title` attribute or tooltip)

---

## 3. Sidebar Integration

### NAV_LABELS addition

```ts
tr: { coachingTracking: "Coaching Takibi" }
en: { coachingTracking: "Coaching Tracking" }
```

### Reports group expansion

Current sub-items: `reports`, `negKeywords`  
New sub-items: `reports`, `negKeywords`, `coachingTracking`

The `reportsOpen` state must expand when `activeTab === "coachingTracking"`.  
The `maxHeight` of the accordion container must increase to accommodate 3 items.

`coachingTracking` tab is only rendered in the nav when `isManagerLike` (Admin + Manager).

### Tab content rendering

```tsx
{activeTab === "coachingTracking" && isManagerLike && (
  <CoachingTrackingView lang={lang} />
)}
```

---

## 4. i18n Keys

New keys to add to `translations` in `app/lib/i18n.ts`:

| Key | TR | EN |
|-----|----|----|
| `coachingTracking` | Coaching Takibi | Coaching Tracking |
| `coachingTrackingTitle` | Coaching & Değerlendirme Takibi | Coaching & Evaluation Tracking |
| `totalEvaluations` | Toplam Değerlendirme | Total Evaluations |
| `agentReadCount` | Okunan | Read |
| `coachingDoneCount` | Coaching Yapılan | Coaching Done |
| `agentReadLabel` | Okundu | Read |
| `notReadLabel` | Okunmadı | Not Read |
| `coachingDoneLabel` | Yapıldı | Done |
| `coachingNotDoneLabel` | Yapılmadı | Not Done |
| `noEvaluationsInRange` | Bu tarih aralığında değerlendirme bulunamadı. | No evaluations found in this date range. |

---

## 5. File Changes Summary

| File | Change |
|------|--------|
| `app/api/reports/coaching-tracking/route.ts` | **New** — GET endpoint |
| `app/components/shared/CoachingTrackingView.tsx` | **New** — dashboard component |
| `app/components/LandingPage.tsx` | Add nav item, tab handler, tab render |
| `app/lib/i18n.ts` | Add new translation keys |

---

## 6. Out of Scope

- No write operations from this view (read-only dashboard)
- No export to CSV/PDF (can be added later)
- Team Leaders do not see this dashboard (by design)
- No push notifications triggered by this view
