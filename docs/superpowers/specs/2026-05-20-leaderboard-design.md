# Leaderboard — Design Spec

## Goal

Satış ekibinin en iyi 5 danışmanını skor bazlı sıralayan, tüm roller tarafından erişilebilen bir Sıralama ekranı.

## Görünürlük & Davranış

| Rol | Erişim | Period Filtresi |
|-----|--------|-----------------|
| AGENT | ✅ Top 5 görür | Sabit: Son 30 gün |
| TEAM_LEADER | ✅ Top 5 görür | Sabit: Son 30 gün |
| MANAGER | ✅ Top 5 görür | Seçilebilir |
| ADMIN | ✅ Top 5 görür | Seçilebilir |

- Danışman top 5'te değilse kendi pozisyonu **gösterilmez**
- Sıfır değerlendirmesi olan danışmanlar listeye **girmez**

---

## API

### `GET /api/leaderboard`

**Query parametreleri:**
- `period` — `"30d"` (varsayılan) | `"3m"` | `"all"`
  - AGENT ve TEAM_LEADER için her zaman `"30d"` olarak işlenir (parametre yok sayılır)

**Yetkilendirme:** Tüm roller (AGENT, TEAM_LEADER, MANAGER, ADMIN)

**Sıralama mantığı:**
- Seçilen zaman dilimine göre her danışmanın `avgScore`'u hesaplanır
- `avgScore` desc sıralanır; eşitlikte `callCount` desc
- Maksimum 5 kayıt döndürülür

**Yanıt:**
```json
{
  "entries": [
    {
      "rank": 1,
      "agentId": "...",
      "name": "Mehmet Y.",
      "teamName": "Takım A",
      "avgScore": 87,
      "callCount": 24
    }
  ],
  "period": "30d",
  "totalAgents": 12
}
```

---

## UI Bileşeni — `LeaderboardView`

**Props:** `{ lang: "tr" | "en"; userRole: string }`

**Görünüm:**
```
┌─────────────────────────────────────────────┐
│  SIRALAMA              [Son 30 gün ▾]       │  ← filtre sadece MANAGER/ADMIN
│                                             │
│  🥇  Mehmet Y.      87 ort  ·  24 çağrı   │
│       Takım A                               │
│                                             │
│  🥈  Ali K.         83 ort  ·  31 çağrı   │
│       Takım B                               │
│                                             │
│  🥉  Selin T.       79 ort  ·  18 çağrı   │
│       Takım A                               │
│                                             │
│  4   Deniz M.       76 ort  ·  22 çağrı   │
│       Takım C                               │
│                                             │
│  5   Ayşe R.        74 ort  ·  15 çağrı   │
│       Takım B                               │
│                                             │
│  12 danışman arasından · Son 30 gün        │
└─────────────────────────────────────────────┘
```

**Detaylar:**
- 1. sıra: 🥇, 2. sıra: 🥈, 3. sıra: 🥉, 4-5. sıra: düz numara
- Period seçici (`Son 30 gün / Son 3 ay / Tüm zamanlar`) yalnızca MANAGER ve ADMIN'de görünür
- Period değişince API yeniden çağrılır
- **Yükleniyor:** İskelet satırlar (loading skeleton)
- **Boş durum:** "Henüz yeterli değerlendirme yok"

---

## Navigasyon Entegrasyonu

`app/components/LandingPage.tsx` içinde:

**`mainNavItems`'a eklenir — tüm roller için:**
```tsx
mainNavItems.push({ key: "leaderboard", icon: "star" });
```

**`NAV_LABELS`'a eklenir:**
```ts
tr: { leaderboard: "Sıralama" }
en: { leaderboard: "Rankings" }
```

**Tab içeriği:**
```tsx
{activeTab === "leaderboard" && (
  <div className={styles.page}>
    <LeaderboardView lang={lang} userRole={user.role} />
  </div>
)}
```

---

## Dosya Haritası

| Dosya | İşlem |
|-------|-------|
| `app/api/leaderboard/route.ts` | GET endpoint — top 5, period filtresi, rol bazlı kural |
| `app/components/shared/LeaderboardView.tsx` | UI bileşeni |
| `app/components/LandingPage.tsx` | NAV_LABELS, mainNavItems, tab render |
