# Faz 1 — Kategori Scoring & Coaching Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her AI değerlendirmesinden A/B/C bölüm skorlarını ve en zayıf kriterleri DB'ye kaydet; agent dashboard'unda bölüm analizi kartı, evaluation detay sayfasında coaching kartı göster.

**Architecture:** Analyze route'u AI yanıtındaki `===JSON_DATA===` bloğunu parse ederek yapılandırılmış skorları çeker ve evaluations tablosuna kaydeder. Scores API bu verileri ortalar ve ScoreView'e geçirir. Evaluation detay sayfası per-evaluation coaching notlarını gösterir.

**Tech Stack:** Next.js 16, Prisma (PostgreSQL/Supabase), TypeScript, Tailwind CSS, Groq API (llama-3.3-70b-versatile)

---

## Dosya Haritası

| Dosya | İşlem | Amaç |
|-------|-------|-------|
| `prisma/schema.prisma` | Modify | `sectionScores Json?` ve `weakCriteria Json?` alanları ekle |
| `app/api/analyze/route.ts` | Modify | JSON_DATA bloğu parse, clean report dön |
| `app/api/evaluations/route.ts` | Modify | POST: yeni alanları kaydet + bildirim metni güncelle |
| `app/api/scores/route.ts` | Modify | avgSectionScores ve topWeakCriteria hesapla, response'a ekle |
| `app/components/shared/ScoreView.tsx` | Modify | ScoreData interface'e yeni alanlar, Bölüm Analizi kartı ekle |
| `app/evaluation/[id]/page.tsx` | Modify | Sol panele coaching kartı ekle |

---

## Task 1: Prisma Migration — sectionScores & weakCriteria

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Evaluation modeline iki alan ekle**

`prisma/schema.prisma` içinde `Evaluation` modelini bul (şu an `promptId` ile biten alan), hemen altına ekle:

```prisma
model Evaluation {
  id           String    @id @default(cuid())
  agentId      String
  agent        User      @relation("EvaluatedAgent", fields: [agentId], references: [id])
  customerName String
  callDuration String
  transcript   String
  report       String
  score        Int
  callType     CallType  @default(SECOND_CALL)
  promptId     String?
  sectionScores Json?
  weakCriteria  Json?
  callDate     DateTime  @default(now())
  createdAt    DateTime  @default(now())
}
```

- [ ] **Step 2: Migration çalıştır**

```bash
cd /Users/sorcerer/sdr-analyzer
npx prisma migrate dev --name add_category_scores
```

Beklenen çıktı: `✓ Your database is now in sync with your schema.`

- [ ] **Step 3: Verify**

```bash
npx prisma studio
```

Tarayıcıda Prisma Studio açılır, `Evaluation` tablosunda `sectionScores` ve `weakCriteria` kolonlarının göründüğünü doğrula. Mevcut kayıtlar `null` olarak görünmeli. Sonra Prisma Studio'yu kapat (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add sectionScores and weakCriteria fields to Evaluation"
```

---

## Task 2: Analyze Route — JSON_DATA Block Parsing

**Files:**
- Modify: `app/api/analyze/route.ts`

- [ ] **Step 1: Groq yanıtı alındıktan sonra JSON_DATA parse bloğunu ekle**

`app/api/analyze/route.ts` içinde şu satırı bul:

```typescript
const reportText = groqData.choices[0].message.content;
```

Bu satırın hemen altına, mevcut `scoreMatch` regex'inden ÖNCE şunu ekle:

```typescript
const reportText = groqData.choices[0].message.content;

// JSON_DATA bloğunu çek ve rapor metninden temizle
const jsonBlockMatch = reportText.match(/===JSON_DATA===([\s\S]*?)===END_JSON===/);
let sectionScores: { A: number; B: number; C: number } | null = null;
let weakCriteria: Array<{ id: string; label: string; score: number; coachingNote: string }> | null = null;

if (jsonBlockMatch) {
  try {
    const parsed = JSON.parse(jsonBlockMatch[1].trim());
    if (parsed.sectionScores && typeof parsed.sectionScores === "object") {
      sectionScores = parsed.sectionScores;
    }
    if (Array.isArray(parsed.weakCriteria)) {
      weakCriteria = parsed.weakCriteria;
    }
  } catch {
    // JSON parse başarısız — sectionScores ve weakCriteria null kalır
  }
}

// JSON bloğunu görüntülenen rapordan çıkar
const cleanReport = reportText.replace(/\n*===JSON_DATA===[\s\S]*?===END_JSON===/g, "").trim();
```

- [ ] **Step 2: scoreMatch'i cleanReport üzerinde çalıştır**

Mevcut `scoreMatch` satırını bul:

```typescript
const scoreMatch = reportText.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
const score = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : 0;
```

`reportText` → `cleanReport` olarak değiştir:

```typescript
const scoreMatch = cleanReport.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
const score = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : 0;
```

- [ ] **Step 3: Return statement'a yeni alanları ekle**

Mevcut return'ü bul:

```typescript
return NextResponse.json({
  report: reportText,
  score,
  callType,
  promptId: activePrompt.id,
});
```

Şununla değiştir:

```typescript
return NextResponse.json({
  report: cleanReport,
  score,
  callType,
  promptId: activePrompt.id,
  sectionScores,
  weakCriteria,
});
```

- [ ] **Step 4: Manuel test**

Sunucu çalışıyorsa (`npm run dev`) tarayıcıdan bir değerlendirme yap. Developer Tools → Network → `/api/analyze` yanıtında `sectionScores` ve `weakCriteria` alanlarının göründüğünü kontrol et. Prompt henüz JSON bloğu üretmediği için `null` dönmesi normaldir — bu sonraki taskta düzelecek.

- [ ] **Step 5: Commit**

```bash
git add app/api/analyze/route.ts
git commit -m "feat: parse JSON_DATA block from AI response in analyze route"
```

---

## Task 3: Evaluations POST — Yeni Alanları Kaydet + Bildirim Güncelle

**Files:**
- Modify: `app/api/evaluations/route.ts`

- [ ] **Step 1: POST handler'da destructuring'e yeni alanları ekle**

`app/api/evaluations/route.ts` içinde POST handler'ı bul. Şu satırı bul:

```typescript
const { agentId, customerName, callDuration, transcript, report, score, callType, promptId } = await req.json();
```

Şununla değiştir:

```typescript
const { agentId, customerName, callDuration, transcript, report, score, callType, promptId, sectionScores, weakCriteria } = await req.json();
```

- [ ] **Step 2: prisma.evaluation.create'e yeni alanları ekle**

`evaluation.create` içindeki `data` objesini bul:

```typescript
data: {
  agentId, customerName, callDuration, transcript, report, score,
  ...(callType && { callType }),
  ...(promptId && { promptId }),
},
```

Şununla değiştir:

```typescript
data: {
  agentId, customerName, callDuration, transcript, report, score,
  ...(callType && { callType }),
  ...(promptId && { promptId }),
  ...(sectionScores && { sectionScores }),
  ...(weakCriteria && weakCriteria.length > 0 && { weakCriteria }),
},
```

- [ ] **Step 3: Bildirim metnini güncelle**

`notifyIds.map(...)` içindeki `message` satırını bul:

```typescript
message: `${customerName} müşterisi için değerlendirme tamamlandı. Skor: %${score}`,
```

Şununla değiştir:

```typescript
message: Array.isArray(weakCriteria) && weakCriteria.length > 0
  ? `${customerName} müşterisi değerlendirmen hazır (%${score}). ${weakCriteria.length} gelişim alanın var.`
  : `${customerName} müşterisi için değerlendirme tamamlandı. Skor: %${score}`,
```

- [ ] **Step 4: Frontend evaluation oluşturma call site'larını güncelle**

Projede `fetch("/api/evaluations"` veya `fetch('/api/evaluations'` içeren dosyaları bul:

```bash
grep -rn "api/evaluations" /Users/sorcerer/sdr-analyzer/app --include="*.tsx" --include="*.ts" | grep -i "POST\|method"
```

Bulunan her dosyada, `/api/evaluations` POST isteği oluşturan body'ye `sectionScores` ve `weakCriteria` alanlarını ekle. Örnek — body'deki `promptId` satırının altına:

```typescript
body: JSON.stringify({
  // ...mevcut alanlar...
  promptId: analyzeResult.promptId,
  sectionScores: analyzeResult.sectionScores ?? null,
  weakCriteria: analyzeResult.weakCriteria ?? null,
}),
```

- [ ] **Step 5: Commit**

```bash
git add app/api/evaluations/route.ts
git commit -m "feat: store sectionScores and weakCriteria on evaluation create, update notification text"
```

---

## Task 4: Scores API — avgSectionScores & topWeakCriteria

**Files:**
- Modify: `app/api/scores/route.ts`

- [ ] **Step 1: avgSectionScores hesaplama bloğunu ekle**

`app/api/scores/route.ts` içinde şu satırı bul (Son çağrılar hesaplandıktan sonra, ilk `return NextResponse.json` öncesi):

```typescript
const recentCalls = evaluations.slice(0, 5).map(e => ({
```

Bu bloğun hemen ALTINA (recentCalls tanımlandıktan sonra), `if (totalCalls > 0)` return'ünden önce şu kodu ekle:

```typescript
// Ortalama bölüm skorları
const evalsWithSections = evaluations.filter(e => e.sectionScores);
let avgSectionScores: { A: number; B: number; C: number } | null = null;
if (evalsWithSections.length > 0) {
  const totals = evalsWithSections.reduce(
    (acc, e) => {
      const ss = e.sectionScores as { A: number; B: number; C: number };
      return { A: acc.A + (ss.A || 0), B: acc.B + (ss.B || 0), C: acc.C + (ss.C || 0) };
    },
    { A: 0, B: 0, C: 0 }
  );
  const n = evalsWithSections.length;
  avgSectionScores = {
    A: Math.round(totals.A / n),
    B: Math.round(totals.B / n),
    C: Math.round(totals.C / n),
  };
}

// Frekans bazlı en zayıf kriterler
const criteriaMap: Record<string, { label: string; totalScore: number; count: number }> = {};
evaluations.forEach(e => {
  if (!e.weakCriteria || !Array.isArray(e.weakCriteria)) return;
  (e.weakCriteria as Array<{ id: string; label: string; score: number }>).forEach(c => {
    if (!criteriaMap[c.id]) criteriaMap[c.id] = { label: c.label, totalScore: 0, count: 0 };
    criteriaMap[c.id].totalScore += c.score;
    criteriaMap[c.id].count += 1;
  });
});
const topWeakCriteria = Object.entries(criteriaMap)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 3)
  .map(([id, v]) => ({
    id,
    label: v.label,
    avgScore: Math.round(v.totalScore / v.count),
    count: v.count,
  }));
```

- [ ] **Step 2: Gerçek veri return'üne yeni alanları ekle**

`if (totalCalls > 0)` bloğundaki return'ü bul:

```typescript
return NextResponse.json({
  agent: { id: agent.id, name: agent.name, role: agent.role, team: agent.team?.name || "Takimsiz" },
  rank, totalAgents: allAgents.length,
  stats: { totalCalls, avgScore, highestScore },
  weeklyProgress, recentCalls, isDemo: false,
});
```

Şununla değiştir:

```typescript
return NextResponse.json({
  agent: { id: agent.id, name: agent.name, role: agent.role, team: agent.team?.name || "Takimsiz" },
  rank, totalAgents: allAgents.length,
  stats: { totalCalls, avgScore, highestScore },
  weeklyProgress, recentCalls, isDemo: false,
  avgSectionScores,
  topWeakCriteria,
});
```

- [ ] **Step 3: Demo veri return'üne null/boş değerleri ekle**

Demo veriyi döndüren son `return NextResponse.json(...)` içine ekle (`isDemo: true` satırının yanına):

```typescript
return NextResponse.json({
  agent: { id: agent.id, name: agent.name, role: agent.role, team: agent.team?.name || "Takimsiz" },
  rank: demo.rank, totalAgents: demoTotalAgents,
  stats: { totalCalls: demo.calls, avgScore: demo.avg, highestScore: demo.highest },
  weeklyProgress: demoWeeklyProgress, recentCalls: demoRecentCalls, isDemo: true,
  avgSectionScores: null,
  topWeakCriteria: [],
});
```

- [ ] **Step 4: Commit**

```bash
git add app/api/scores/route.ts
git commit -m "feat: calculate avgSectionScores and topWeakCriteria in scores API"
```

---

## Task 5: ScoreView — Bölüm Analizi Kartı

**Files:**
- Modify: `app/components/shared/ScoreView.tsx`

- [ ] **Step 1: ScoreData interface'e yeni alanları ekle**

`app/components/shared/ScoreView.tsx` içindeki `ScoreData` interface'ini bul:

```typescript
interface ScoreData {
  agent: { id: string; name: string; role: string; team: string };
  rank: number;
  totalAgents: number;
  stats: { totalCalls: number; avgScore: number; highestScore: number };
  weeklyProgress: { week: string; score: number; calls: number }[];
  recentCalls: { id: string; date: string; customer: string; score: number; callType: string; duration: string }[];
  isDemo?: boolean;
}
```

Şununla değiştir:

```typescript
interface ScoreData {
  agent: { id: string; name: string; role: string; team: string };
  rank: number;
  totalAgents: number;
  stats: { totalCalls: number; avgScore: number; highestScore: number };
  weeklyProgress: { week: string; score: number; calls: number }[];
  recentCalls: { id: string; date: string; customer: string; score: number; callType: string; duration: string }[];
  isDemo?: boolean;
  avgSectionScores?: { A: number; B: number; C: number } | null;
  topWeakCriteria?: Array<{ id: string; label: string; avgScore: number; count: number }> | null;
}
```

- [ ] **Step 2: Destructuring'e yeni alanları ekle**

`const { agent, rank, totalAgents, stats, weeklyProgress, recentCalls, isDemo } = data;` satırını bul ve şununla değiştir:

```typescript
const { agent, rank, totalAgents, stats, weeklyProgress, recentCalls, isDemo, avgSectionScores, topWeakCriteria } = data;
```

- [ ] **Step 3: Bölüm Analizi kartını Stats kartlarının altına ekle**

`{/* Stats */}` bloğunun kapanışını (`</div>` sonrası) bul ve hemen altına ekle:

```tsx
{/* Section Scores */}
{avgSectionScores && (
  <div className="bg-surface-container rounded-3xl p-8">
    <h3 className="font-headline text-lg font-bold mb-6 flex items-center gap-2">
      <MIcon name="analytics" className="text-primary" />
      Bölüm Analizi
      <span className="text-xs text-slate-500 font-normal ml-1">({stats.totalCalls} çağrı ortalaması)</span>
    </h3>
    <div className="space-y-4">
      {([
        { key: "A" as const, label: "A — Giriş & Profilleme", weight: "%20" },
        { key: "B" as const, label: "B — Çözüm & Otorite", weight: "%45" },
        { key: "C" as const, label: "C — Kapanış & Köprü", weight: "%35" },
      ]).map(({ key, label, weight }) => {
        const val = avgSectionScores[key];
        const barColor = val >= 85 ? "bg-emerald-500" : val >= 70 ? "bg-primary" : val >= 55 ? "bg-amber-500" : "bg-red-500";
        const textColor = val >= 85 ? "text-emerald-400" : val >= 70 ? "text-primary" : val >= 55 ? "text-amber-400" : "text-error";
        return (
          <div key={key}>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-slate-400">
                {label} <span className="text-xs text-slate-600">{weight}</span>
              </span>
              <span className={`font-bold text-sm ${textColor}`}>%{val}</span>
            </div>
            <div className="h-2 bg-surface-container-lowest rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
    {topWeakCriteria && topWeakCriteria.length > 0 && (
      <div className="mt-6 pt-5 border-t border-outline-variant">
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">En Zayıf Kriterler</p>
        <div className="space-y-2">
          {topWeakCriteria.map(c => {
            const isRed = c.avgScore < 55;
            const isOrange = c.avgScore >= 55 && c.avgScore < 70;
            const cardClass = isRed
              ? "bg-red-500/10 border-red-500/30"
              : isOrange
              ? "bg-amber-500/10 border-amber-500/30"
              : "bg-yellow-500/10 border-yellow-500/30";
            const textClass = isRed ? "text-red-400" : isOrange ? "text-amber-400" : "text-yellow-400";
            return (
              <div key={c.id} className={`flex justify-between items-center px-3 py-2 rounded-lg border ${cardClass}`}>
                <span className={`text-xs font-medium ${textClass}`}>{c.id} — {c.label}</span>
                <span className={`text-xs font-bold ${textClass}`}>%{c.avgScore}</span>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Tarayıcıda doğrula**

`http://localhost:3000` → Agent olarak giriş → Scores sekmesi. Gerçek evaluation varsa Bölüm Analizi kartı görünmeli. Yoksa kart gösterilmemeli (null check çalışıyor).

- [ ] **Step 5: Commit**

```bash
git add app/components/shared/ScoreView.tsx
git commit -m "feat: add section score breakdown card to ScoreView"
```

---

## Task 6: Evaluation Detail — Coaching Kartı

**Files:**
- Modify: `app/evaluation/[id]/page.tsx`

- [ ] **Step 1: Sol panelin üstüne coaching kartını ekle**

`app/evaluation/[id]/page.tsx` içinde sol paneli bul (`{/* Left: Report */}` yorumu):

```tsx
{/* Left: Report */}
<div className="bg-surface-container border border-outline-variant rounded-2xl overflow-y-auto p-6 leading-relaxed">
  {isTranslating ? (
```

Bu `<div>` içinin en başına, `{isTranslating ?` ifadesinden ÖNCE coaching kartını ekle:

```tsx
{/* Left: Report */}
<div className="bg-surface-container border border-outline-variant rounded-2xl overflow-y-auto p-6 leading-relaxed">
  {evaluation.weakCriteria && Array.isArray(evaluation.weakCriteria) && (evaluation.weakCriteria as any[]).length > 0 && (
    <div className="mb-6 bg-surface-container-high border border-primary/20 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2.5 py-1 rounded-full border border-primary/20 tracking-wide">
          COACHING
        </span>
        <span className="text-sm font-bold text-on-surface">Bu Çağrıda Yapılabilecek 3 Şey</span>
      </div>
      <div className="space-y-3">
        {(evaluation.weakCriteria as Array<{ id: string; label: string; score: number; coachingNote: string }>).map(
          (c, idx) => {
            const palette = [
              { card: "bg-red-500/10 border-red-500/30", num: "bg-red-500/20 text-red-400", label: "text-red-300" },
              { card: "bg-orange-500/10 border-orange-500/30", num: "bg-orange-500/20 text-orange-400", label: "text-orange-300" },
              { card: "bg-yellow-500/10 border-yellow-500/30", num: "bg-yellow-500/20 text-yellow-400", label: "text-yellow-300" },
            ];
            const p = palette[idx % palette.length];
            return (
              <div key={c.id} className={`flex gap-3 p-3 rounded-xl border ${p.card}`}>
                <span className={`flex-shrink-0 w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center ${p.num}`}>
                  {idx + 1}
                </span>
                <div>
                  <p className={`text-[11px] font-semibold mb-1 ${p.label}`}>{c.id} — {c.label}</p>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">{c.coachingNote}</p>
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  )}
  {isTranslating ? (
```

- [ ] **Step 2: Tarayıcıda doğrula**

Mevcut bir evaluation'a git (`/evaluation/[herhangi-id]`). `weakCriteria` null olan eski kayıtlarda coaching kartı görünmemeli. Yeni bir evaluation oluşturduktan sonra (prompt güncellendikten sonra, Task 8) kartın göründüğünü doğrula.

- [ ] **Step 3: Commit**

```bash
git add app/evaluation/[id]/page.tsx
git commit -m "feat: add coaching card to evaluation detail page"
```

---

## Task 7: Refine Route — weakCriteria Güncelleme

**Files:**
- Modify: `app/api/evaluations/[id]/refine/route.ts`

- [ ] **Step 1: Refine route'u oku**

```bash
cat /Users/sorcerer/sdr-analyzer/app/api/evaluations/[id]/refine/route.ts
```

- [ ] **Step 2: Refine sonrası sectionScores ve weakCriteria güncelle**

Refine route'unda AI'dan yeni rapor alındıktan sonra (mevcut `score` güncelleme kodunun yanına) aynı JSON_DATA parse mantığını ekle. Analyze route'tan (Task 2) kopyala:

```typescript
// Refine yanıtından da JSON_DATA parse et
const refineJsonMatch = newReport.match(/===JSON_DATA===([\s\S]*?)===END_JSON===/);
let refinedSectionScores = null;
let refinedWeakCriteria = null;
if (refineJsonMatch) {
  try {
    const parsed = JSON.parse(refineJsonMatch[1].trim());
    if (parsed.sectionScores) refinedSectionScores = parsed.sectionScores;
    if (Array.isArray(parsed.weakCriteria)) refinedWeakCriteria = parsed.weakCriteria;
  } catch { /* parse başarısız — mevcut değerler korunur */ }
}
const cleanRefineReport = newReport.replace(/\n*===JSON_DATA===[\s\S]*?===END_JSON===/g, "").trim();
```

Ardından `prisma.evaluation.update` içine ekle:

```typescript
await prisma.evaluation.update({
  where: { id },
  data: {
    report: cleanRefineReport,
    score: newScore,
    ...(refinedSectionScores && { sectionScores: refinedSectionScores }),
    ...(refinedWeakCriteria && refinedWeakCriteria.length > 0 && { weakCriteria: refinedWeakCriteria }),
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/api/evaluations/[id]/refine/route.ts
git commit -m "feat: update sectionScores and weakCriteria on evaluation refine"
```

---

## Task 8: Prompt Güncellemeleri (Admin Panel)

**Amaç:** Her iki prompt'a (v11.2 ve v10.13) JSON_DATA bloğu üretim talimatını ekle.

- [ ] **Step 1: Admin panelden v11.2 promptunu aç**

`http://localhost:3000` → Admin/Manager ile giriş → Ayarlar → Prompt Yönetimi → SECOND_CALL aktif promptunu bul ve düzenle.

- [ ] **Step 2: v11.2 prompt içeriğinin sonuna şu metni ekle**

```
---
ZORUNLU EK ÇIKTI — RAPOR SONUNA EKLE:
Raporun tamamlanmasının ardından, başka hiçbir metin olmaksızın, tam olarak şu bloğu ekle:

===JSON_DATA===
{"sectionScores":{"A":[A_PUANI],"B":[B_PUANI],"C":[C_PUANI]},"weakCriteria":[{"id":"[KRİTER_ID]","label":"[KRİTER_ADI]","score":[PUAN],"coachingNote":"[KOÇLUK_NOTU]"}]}
===END_JSON===

Kurallar:
- sectionScores: A (%20), B (%45), C (%35) bölümlerinin hesaplanan 0-100 arası tam sayı ağırlıklı puanları
- weakCriteria: Skoru 80'in altındaki kriterlerin en düşük puanlı en fazla 3 tanesi; tüm kriterler 80+ ise boş dizi []
- N/A veya uygulanamaz kriterler dahil edilmez
- coachingNote: "sen" diliyle Türkçe, 1-2 cümle, somut ve uygulanabilir eylem önerisi
- Geçerli JSON formatı zorunlu — açıklama veya yorum ekleme
```

- [ ] **Step 3: v10.13 promptunu güncelle**

Aynı adımları FIRST_CALL aktif promptu için tekrarla. `sectionScores` açıklamasını şu şekilde değiştir:

```
- sectionScores: A (Giriş & Profilleme), B (Çözüm & Otorite), C (Kapanış & Sonraki Adımlar) bölümlerinin 0-100 arası ağırlıklı tam sayı puanları
```

- [ ] **Step 4: End-to-end test**

Yeni bir değerlendirme oluştur (herhangi bir transkript ile). Adımları kontrol et:

1. `/api/analyze` yanıtında `sectionScores` ve `weakCriteria` `null` değil, gerçek değerler içeriyor
2. Evaluation kaydı oluşturulduktan sonra Prisma Studio'da `sectionScores` ve `weakCriteria` colonları dolu görünüyor
3. `/evaluation/[yeni-id]` sayfasında coaching kartı görünüyor
4. Agent bildirimi "N gelişim alanın var" içeriyor
5. Agent → Scores sekmesinde Bölüm Analizi kartı görünüyor

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Faz 1 complete — category scoring and coaching loop"
```

---

## Self-Review Checklist

- [x] Spec §3 (DB şeması) → Task 1
- [x] Spec §4.1 (Prompt JSON bloğu) → Task 8
- [x] Spec §4.2 (Parsing mantığı) → Task 2
- [x] Spec §4.3 (Evaluation kaydı) → Task 3
- [x] Spec §5.1 (ScoreView Bölüm Analizi) → Task 5
- [x] Spec §5.2 (Coaching kartı) → Task 6
- [x] Spec §5.3 (Bildirim metni) → Task 3
- [x] Spec §8 (Scores API) → Task 4
- [x] Refine route güncelleme (spec dışı ama tutarlılık için) → Task 7
