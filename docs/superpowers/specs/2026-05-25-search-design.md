# Search Feature Design

**Date:** 2026-05-25  
**Status:** Approved

## Overview

A search tab accessible to all roles that lets users find evaluations by customer name or transcript content. Results are scoped by role: agents see only their own calls, team leaders see their team's calls, managers and admins see all calls.

## 1. Sidebar & Navigation

- Add `{ key: "search", icon: "search" }` to `mainNavItems` in `LandingPage.tsx` for all roles.
- Add translations to `NAV_LABELS`: TR `"Arama"`, EN `"Search"`.
- The item appears in the main nav like all other sidebar links.
- `handleTab("search")` activates the tab. Activity logging follows the same pattern as other tabs.

## 2. API — `GET /api/search`

**File:** `app/api/search/route.ts`

**Query params:**
- `q` — search query string (minimum 2 characters, validated server-side)

**Role-based scoping** (mirrors `/api/evaluations` GET):
- `AGENT` → `agentId = user.id`
- `TEAM_LEADER` → resolves leading team via `prisma.team.findUnique({ where: { leaderId: user.id } })`, then `agentId IN team members`
- `MANAGER` / `ADMIN` → no agent restriction, full access

**Search logic:**
```
WHERE (customerName CONTAINS q OR transcript CONTAINS q)
  AND <role scope>
```
Both `contains` conditions use `mode: "insensitive"` for case-insensitive matching.

**Response fields** (transcript excluded to keep payload small):
```json
{
  "results": [
    {
      "id": "...",
      "customerName": "...",
      "callType": "FIRST_CALL",
      "score": 82,
      "callDate": "2026-05-10T...",
      "createdAt": "2026-05-10T...",
      "agent": { "name": "Ahmet Yılmaz" }
    }
  ]
}
```

**Constraints:**
- Returns 401 if not authenticated.
- Returns 400 `{ error: "En az 2 karakter girin." }` if `q.length < 2`.
- `orderBy: { createdAt: "desc" }`, `take: 50`.

## 3. `SearchView` Component

**File:** `app/components/shared/SearchView.tsx`

**Props:**
```ts
interface SearchViewProps {
  lang: "tr" | "en";
}
```

**UI layout:**
```
┌──────────────────────────────────────┐
│  [ input: Müşteri adı veya transkript ]  [ Ara ] │
└──────────────────────────────────────┘
  ── results ──
  ┌─────────────────────────────────────┐
  │ Ahmet Yılmaz · FIRST_CALL · 85%    │
  │ Danışman: Mehmet Kaya · 10 May 2026 │
  └─────────────────────────────────────┘
  ...
```

**Behavior:**
- "Ara" button click OR Enter keypress triggers `fetch("/api/search?q=...")`.
- Loading spinner shown during fetch.
- Empty state (no query submitted): instruction text.
- `q.length < 2`: client-side warning, no fetch.
- No results: "Sonuç bulunamadı." / "No results found."
- Clicking a result card navigates to `/evaluation/[id]`.

**i18n strings:**
| Key | TR | EN |
|-----|----|----|
| placeholder | "Müşteri adı veya transkript içeriği..." | "Customer name or transcript content..." |
| button | "Ara" | "Search" |
| hint | "En az 2 karakter girin." | "Enter at least 2 characters." |
| empty | "Sonuç bulunamadı." | "No results found." |
| agent_label | "Danışman" | "Consultant" |

## 4. LandingPage Integration

In `LandingPage.tsx`:
- Add `search` to `NAV_LABELS` (both languages).
- Add `{ key: "search", icon: "search" }` to `mainNavItems` (unconditionally — all roles).
- Add a new `{activeTab === "search" && ...}` block in the content area that renders `<SearchView lang={lang} />`.
- No new state needed in LandingPage.

## Out of Scope

- Pagination beyond 50 results.
- Filtering by date, call type, or score within the search tab.
- Highlighting matched text in the result card.
- Search history / saved searches.
