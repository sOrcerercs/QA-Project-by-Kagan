# Call Type Auto-Detection & Re-classification Design

**Date:** 2026-05-20  
**Status:** Approved

## Problem

Calls are being evaluated with the wrong prompt. The current auto-classifier only reads the first 500 chars of the transcript and falls back to `SECOND_CALL` on any ambiguity, causing systematic misclassification.

**Business Rule:**
- Agent asks customer for **photos** → `FIRST_CALL` (profiling phase, hasn't seen photos yet)
- Agent explains **treatment plan / technique / package** → `SECOND_CALL` (presenting solution after reviewing photos)

Only `FIRST_CALL` and `SECOND_CALL` are actively used. `FOLLOW_UP` and `GENERAL` are not auto-detected.

## Architecture

Three independent parts:

1. **`lib/callTypeDetector.ts`** — Central detection utility (new file)
2. **Re-evaluation button** — On evaluation detail page for ADMIN/MANAGER
3. **Bulk re-classification tool** — Admin panel tab for fixing historical evaluations

---

## Part 1: `app/lib/callTypeDetector.ts`

Single exported function:

```typescript
detectCallType(transcript: string): Promise<"FIRST_CALL" | "SECOND_CALL">
```

### Stage 1 — Keyword scan (synchronous, no API cost)

Scans the **full transcript** (not just 500 chars).

| Signal | Keywords | Result |
|--------|----------|--------|
| Photo request | `photo`, `fotoğraf`, `resim`, `picture`, `whatsapp`, `send me`, `gönderir misiniz` | FIRST_CALL |
| Treatment plan | `FUE`, `DHI`, `graft`, `donor`, `donör`, `sapphire`, `paket`, `package`, `otel`, `hotel`, `transfer`, `tedavi planı`, `treatment plan`, `teknik`, `technique`, `ameliyat` | SECOND_CALL |

Decision logic:
- Photo signal only → `FIRST_CALL` (high confidence, return immediately)
- Treatment signal only → `SECOND_CALL` (high confidence, return immediately)
- Both present OR neither → proceed to Stage 2

### Stage 2 — Improved AI classifier (ambiguous cases only)

Uses first **1500 chars** of transcript. Prompt explicitly encodes the business rule:

```
Sen bir satış çağrısı sınıflandırıcısısın.

KURAL:
- Temsilci müşteriden FOTOĞRAF istiyorsa → FIRST_CALL
  (henüz fotoğraf görmeden, müşteriyi profilliyor)
- Temsilci tedavi planı, teknik (FUE/DHI), paket veya fiyat açıklıyorsa → SECOND_CALL
  (fotoğrafları gördükten sonra çözüm sunuyor)

YALNIZCA şunu yaz: FIRST_CALL veya SECOND_CALL
```

Gemini config: `maxOutputTokens: 10`, `temperature: 0`, `thinkingBudget: 0`

Fallback: If AI fails → `SECOND_CALL`

### Integration

Replaces the inline `CLASSIFY_PROMPT` + `callGemini` blocks in:
- `app/api/analyze/route.ts`
- `app/api/batch/route.ts`
- `app/api/calls/sync/route.ts`
- `app/api/calls/sync-fireflies/route.ts`

---

## Part 2: Re-evaluation Button — Evaluation Detail Page

### Who sees it
ADMIN and MANAGER only (same as existing `canEdit`).

### UI
Dropdown button next to the existing "✏️ Düzenle" button:

```
[ ↩ Yeniden Değerlendir ▾ ]
  ├── 🔵 First Call Promptu
  └── 🟣 Second Call Promptu
```

Active only when the selected call type differs from the current one. Greyed out otherwise.

### New endpoint: `POST /api/evaluations/[id]/re-classify`

Request body: `{ callType: "FIRST_CALL" | "SECOND_CALL" }`

Behavior:
1. Auth check: ADMIN or MANAGER only
2. Fetch evaluation (transcript, agentId, customerName, callDuration)
3. Fetch active prompt for the given `callType`
4. Run Gemini evaluation (same logic as batch route)
5. Update evaluation in DB: `callType`, `report`, `score`, `sectionScores`, `weakCriteria`, `promptId`
6. Original `transcript` is preserved

Response: `{ report, score, callType, sectionScores, weakCriteria }`

### UI state
- Button shows "Değerlendiriliyor..." with spinner during request
- On success: page updates report, score, coaching cards in-place (no reload)
- On error: inline error message below the button

---

## Part 3: Bulk Re-classification Tool — Admin Panel

### New tab in `app/settings/admin/page.tsx`
Label: "Şüpheli Sınıflandırmalar"

### Scan phase (no API cost)
- "Tara" button fetches all evaluations (transcript + callType) from DB
- Runs keyword detector on each transcript (Stage 1 only — synchronous, no Gemini)
- Builds list where `storedCallType !== detectedCallType`

### Results table
| Danışman | Müşteri | Mevcut | Öneri | Aksiyon |
|----------|---------|--------|-------|---------|
| Harun Ulu | Tariq Munir | SECOND_CALL ❌ | FIRST_CALL | [Düzelt] |
| Miray İpek | D Anderson | FIRST_CALL ❌ | SECOND_CALL | [Düzelt] |

### Fix phase
- **Single fix**: calls `POST /api/evaluations/[id]/re-classify` for one row
- **Bulk fix**: "Tümünü Düzelt (N değerlendirme)" button — sequential calls with 1s delay
- Progress bar: `3 / 12 tamamlandı`
- Fixed evaluations are removed from the list

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No active prompt for detected call type | Falls back to any active prompt, logs warning |
| Gemini timeout during re-classify | Returns 500, UI shows error, original evaluation unchanged |
| Keyword scan returns same type as stored | Row not shown in suspicious list |
| Both keyword signals present | AI classifier decides; if AI fails → SECOND_CALL |

---

## Files Changed

| File | Change |
|------|--------|
| `app/lib/callTypeDetector.ts` | New — central detection utility |
| `app/api/analyze/route.ts` | Use `detectCallType` instead of inline classifier |
| `app/api/batch/route.ts` | Use `detectCallType` instead of inline classifier |
| `app/api/calls/sync/route.ts` | Use `detectCallType` instead of inline classifier |
| `app/api/calls/sync-fireflies/route.ts` | Use `detectCallType` instead of inline classifier |
| `app/api/evaluations/[id]/re-classify/route.ts` | New endpoint |
| `app/evaluation/[id]/page.tsx` | Add re-classify dropdown button |
| `app/settings/admin/page.tsx` | Add "Şüpheli Sınıflandırmalar" tab |
