# Peer Comparison & Yönetim Karşılaştırması — Tasarım Spec
**Tarih:** 2026-05-03
**Versiyon:** 1.0
**Proje:** SDR Analyzer — ESTENOVE Saç Ekim Kliniği
**Kapsam:** "Nasıl Gidiyorum?" (Agent/TL) + "Karşılaştırma" (Admin/Manager) tab'ları

---

## 1. Genel Bakış

İki farklı görünümden oluşur — rol bazlı render edilir:

| Rol | Görünüm | Başlık |
|-----|---------|--------|
| AGENT | Kendi skorları vs takım ortalaması | "Nasıl Gidiyorum?" |
| TEAM_LEADER | Kendi skorları vs yönettiği takım ortalaması | "Nasıl Gidiyorum?" |
| ADMIN | Takım & danışman seçici + karşılaştırma | "Karşılaştırma" |
| MANAGER | Takım & danışman seçici + karşılaştırma | "Karşılaştırma" |

Her iki görünüm mevcut dashboard tab sistemi içinde eklenir — ayrı sayfa değil.

---

## 2. Veri Modeli

Yeni DB alanı gerekmez. Mevcut alanlar kullanılır:

- `Evaluation.score` → genel skor
- `Evaluation.sectionScores: Json?` → `{ A, B, C }` bölüm skorları
- `Evaluation.weakCriteria: Json?` → `[{ id, label, score, coachingNote }]` kriter detayı
- `Team.leaderId`, `Team.members` → takım yapısı
- `User.teamId` → agent'ın takımı

---

## 3. API 1: `/api/scores/peer` (GET)

### 3.1 Route
`app/api/scores/peer/route.ts` (yeni dosya)

### 3.2 Roller & Auth
`getUserFromToken` ile doğrulama. Sadece `AGENT` ve `TEAM_LEADER` erişebilir. Diğer roller → 403.

### 3.3 Takım Belirleme

| Rol | Takım |
|-----|-------|
| AGENT | `user.teamId` üzerinden `Team.members` |
| TEAM_LEADER | `user.leadingTeam.members` |

`hasTeam: false` dönülecek durumlar: AGENT'ın `teamId` null olması veya TEAM_LEADER'ın `leadingTeam` null olması. Bu durumda `mine` verisi dönülür, `team` null olur.

### 3.4 Hesaplama Mantığı

**`mine` hesabı:**
1. Kullanıcının tüm evaluationlarını çek (sectionScores null olmayanlar dahil hepsi)
2. `overallAvg` = `Math.round(avg(score))`
3. `sectionAvg` = sectionScores null olmayanları al → A/B/C ortalamalarını hesapla, null olan varsa 0 say, en az 1 veri yoksa null dön
4. `callCount` = toplam evaluation sayısı
5. `criteriaBreakdown`: `weakCriteria` null olmayan evaluationlar → her `id` için avg score hesapla → `topCriteriaIds` list (en az 2 değerlendirmede geçen kriterler)

**`team` hesabı:**
1. Tüm takım üyelerinin (user dahil) evaluationlarını çek
2. Aynı metrikler: `overallAvg`, `sectionAvg`
3. `callCountAvg` = toplam evaluation / üye sayısı (Math.round)
4. Her criterion `id` için takım geneli avg score → `criteriaBreakdown[i].teamAvg` hesapla

### 3.5 Response

```typescript
{
  mine: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCount: number;
    criteriaBreakdown: Array<{
      id: string;
      label: string;
      mine: number;      // kullanıcının bu kriterden avg skoru
      teamAvg: number;   // takımın bu kriterden avg skoru
      delta: number;     // mine - teamAvg (pozitif = iyi)
    }>;
  };
  team: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
  } | null;
  teamSize: number;
  hasTeam: boolean;
}
```

---

## 4. API 2: `/api/scores/compare` (GET)

### 4.1 Route
`app/api/scores/compare/route.ts` (yeni dosya)

### 4.2 Roller & Auth
Sadece `ADMIN` ve `MANAGER`. Diğer roller → 403.

### 4.3 Query Parametreleri

| Parametre | Tip | Default | Açıklama |
|-----------|-----|---------|----------|
| `teamIds` | string | boş = tümü | Virgülle ayrılmış team ID'leri. Boş bırakılırsa tüm takımlar. |
| `agentIds` | string | boş = tümü | Virgülle ayrılmış agent ID'leri. Boş bırakılırsa teamIds kapsamındaki tümü. |

### 4.4 Hesaplama

1. `teamIds` boşsa tüm takımları getir; doluysa belirtilenleri filtrele
2. Seçili takım(lar)ın üyelerini getir (`AGENT` rolündekiler)
3. `agentIds` filtresi varsa: sadece o agent'lar
4. Her agent için evaluationlarını çek → `overallAvg`, `sectionAvg`, `callCount`
5. `aggregate`: seçili tüm agentların ağırlıksız ortalamaları
6. `teams` listesi: selector için tüm takımlar (id, name, memberCount)

### 4.5 Response

```typescript
{
  agents: Array<{
    id: string;
    name: string;
    teamId: string;
    teamName: string;
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCount: number;
  }>;
  aggregate: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
    agentCount: number;
  };
  teams: Array<{ id: string; name: string; memberCount: number }>;
}
```

---

## 5. Frontend Bileşenler

### 5.1 Dosya Yapısı

| Dosya | Tip |
|-------|-----|
| `app/components/shared/PeerComparisonView.tsx` | yeni bileşen |
| `app/components/shared/ManagementComparisonView.tsx` | yeni bileşen |
| `app/components/dashboards/AgentDashboard.tsx` | değişiklik |
| `app/components/dashboards/TeamLeaderDashboard.tsx` | değişiklik |
| `app/components/dashboards/AdminDashboard.tsx` | değişiklik |
| `app/dashboard/page.tsx` | değişiklik |

### 5.2 PeerComparisonView

**Props:** `{ agentId: string }`

Bileşen kendi içinde `/api/scores/peer` çağrısı yapar.

**Prompt Güncellemesi Gereksinimi:** `weakCriteria` JSON'ına `section` alanı eklenmelidir (`"A" | "B" | "C"`). Mevcut format:
`{ id, label, score, coachingNote }` → yeni format: `{ id, label, score, section, coachingNote }`

Bu güncelleme olmadan accordion'daki kriter filtrelemesi çalışmaz. Prompt güncellemesi bu task'ın ilk adımı olarak yapılır; eski kayıtlar (section null) accordion'da gösterilmez.

**Yapı:**
1. **Summary banner:** Büyük genel skor + delta badge ("▲ +6 puan" / "▼ −3 puan") + "Takım ortalaması %X"
2. **Bölüm Skorları (A/B/C):** Her biri için:
   - Tıklanabilir kart (accordion)
   - Kart üstü: bölüm adı + mine/team değerleri + delta badge
   - Bar: agent skoru kadar dolu, takım ortalamasında gri dikey referans çizgisi
   - Açılınca: `criteriaBreakdown` içinden `section === "A"|"B"|"C"` eşleşenler → mini bar + delta
   - Eşleşen kriter yoksa: "Bu bölüm için henüz kriter verisi yok." mesajı
3. **Değerlendirme Sayısı:** `mine.callCount` vs `team.callCountAvg` yan yana büyük rakam + bar
4. **`hasTeam: false`:** "Henüz bir takıma atanmamışsın." mesajı, sadece kendi skoru gösterilir

**Delta badge renkleri:**
- `delta > 0` → yeşil (`#4ade80`)
- `delta < 0` → kırmızı (`#f87171`)
- `delta === 0` → gri (`#94a3b8`)

**Loading:** Spinner, skeleton değil.

### 5.3 ManagementComparisonView

**Props:** none (kendi içinde fetch yapar)

**Yapı:**
1. **Filtre bar:**
   - Takım multiselect: "Tüm Takımlar" checkbox + takım listesi (API'dan gelen `teams`)
   - Filtre değişince `/api/scores/compare?teamIds=...` çağrısı
2. **Özet kartlar (3 adet, yatay):** Seçili kapsam aggregate — Genel Ort. | A/B/C Ort. | Toplam Agent
3. **Agent listesi:** Her satır:
   - Avatar (isim baş harfi) + isim + takım adı
   - Genel skor bar (takım geneli aggregate referans çizgisi ile)
   - A / B / C skor chip'leri
   - Değerlendirme sayısı
   - Sıralama: overallAvg'a göre azalan (en yüksek üstte)
4. **Boş durum:** Seçili kapsamda hiç agent yoksa: "Bu takımda henüz danışman bulunmuyor."

### 5.4 Dashboard Entegrasyonu

**AgentDashboard.tsx:**
```typescript
// navItems dizisine ekle:
{ key: "peer", icon: "compare_arrows", label: "Nasıl Gidiyorum?" }
// tab render'ına ekle:
{activeTab === "peer" && <PeerComparisonView agentId={user.id} />}
```

**TeamLeaderDashboard.tsx:**
```typescript
// navItems dizisine ekle:
{ key: "peer", icon: "compare_arrows", label: "Nasıl Gidiyorum?" }
// tab render'ına ekle:
{activeTab === "peer" && <PeerComparisonView agentId={user.id} />}
```

**AdminDashboard.tsx:**
```typescript
// navItems dizisine ekle:
{ key: "compare", icon: "compare_arrows", label: "Karşılaştırma" }
// tab render'ına ekle:
{activeTab === "compare" && <ManagementComparisonView />}
```

**dashboard/page.tsx:**
```typescript
// Mevcut: MANAGER rolü null dönüyor — düzelt:
if (user.role === "MANAGER") return <AdminDashboard user={user} initialTab={initialTab} />;
```

---

## 6. Stil & UX

- Mevcut dashboard tasarımıyla tutarlı: `bg-surface-container rounded-3xl p-8`
- Renk paleti: A → `#818cf8` (indigo), B → `#facc15` (amber), C → `#f87171` (red)
- Takım ortalaması referans çizgisi: `#475569` gri, `ort.` etiketi altında
- Accordion animasyonu: CSS `display: none` toggle (transition yok, basit)

---

## 7. Edge Cases

| Durum | Davranış |
|-------|----------|
| Agent'ın hiç evaluationu yok | `overallAvg: 0`, `callCount: 0`, tüm barlar boş |
| Takımda hiç evaluation yok | `team.overallAvg: 0`, referans çizgisi `left: 0%` |
| `sectionScores` null olan eski kayıtlar | Bölüm avg hesabına dahil edilmez |
| `weakCriteria` boş veya null | `criteriaBreakdown: []`, accordion açılınca "Henüz kriter verisi yok." |
| Manager dashboard'a erişim | `dashboard/page.tsx`'de `MANAGER` → `AdminDashboard` yönlendirmesi ile çözülür |
| Takım üyesi sadece 1 kişi | Team avg = o kişinin skoru, geçerli (kendisiyle kıyaslama) |

---

## 8. Uygulama Sırası

1. **Prompt güncellemesi** — `weakCriteria` JSON'ına `section: "A"|"B"|"C"` alanı ekle (aktif FIRST_CALL ve SECOND_CALL prompt'larını DB'de güncelle)
2. `app/api/scores/peer/route.ts` — kişisel karşılaştırma API
3. `app/api/scores/compare/route.ts` — yönetim karşılaştırma API
4. `app/components/shared/PeerComparisonView.tsx` — Agent/TL bileşeni
5. `app/components/shared/ManagementComparisonView.tsx` — Admin/Manager bileşeni
6. `app/components/dashboards/AgentDashboard.tsx` — tab entegrasyonu
7. `app/components/dashboards/TeamLeaderDashboard.tsx` — tab entegrasyonu
8. `app/components/dashboards/AdminDashboard.tsx` — tab entegrasyonu + Manager fix (`dashboard/page.tsx`)
