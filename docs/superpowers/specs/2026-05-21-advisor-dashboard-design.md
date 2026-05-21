# Advisor Dashboard Design

## Goal

Sidebar'a yeni bir "Danışman Paneli" sekmesi ekle. ADMIN, MANAGER ve TEAM_LEADER rolleri, hiyerarşik seçici üzerinden herhangi bir danışmanın ScoreView'unu rahatlıkla inceleyebilsin.

## Architecture

Tek dosya değişikliği: `app/components/LandingPage.tsx`. Yeni backend endpoint gerekmez — mevcut `/api/teams`, `/api/team/members`, `/api/scores` endpoint'leri yeterlidir. Mevcut `teamreports` tab pattern'ı takip edilir.

## Role-Based Behavior

| Rol | TL Seçimi | Danışman Seçimi |
|-----|-----------|-----------------|
| ADMIN | Tüm TL'leri listeler | Seçili TL'nin takımı |
| MANAGER | Tüm TL'leri listeler | Seçili TL'nin takımı |
| TEAM_LEADER | Yok (atlanır) | Kendi takım üyeleri |

## Navigation

- Tab key: `advisor`
- İkon: `users` (mevcut SVG)
- TR label: `"Danışman Paneli"`, EN label: `"Advisor Dashboard"`
- `mainNavItems`'a eklenir: `isManagerLike || user.role === "TEAM_LEADER"` koşuluyla

## Page Layout

İki sütun, yan yana:

**Sol sütun (~260px, sabit yükseklik, scroll'lanabilir)**
- ADMIN/MANAGER: TL listesi (tıklanabilir kartlar). TL seçilince hemen altında o TL'nin danışman listesi açılır.
- TEAM_LEADER: Direkt danışman listesi (TL adımı yok).
- Her iki listede de seçili öğe `var(--accent)` ile vurgulanır.

**Sağ alan (geri kalan genişlik)**
- Danışman seçiliyse: `<ScoreView data={advisorScoreData} lang={lang} canRefresh={true} />`
- Seçili değilse: ortalanmış "← Bir danışman seçin" / "← Select an advisor" metni (`var(--fg-faint)`)

## State

```typescript
const [advisorTLs, setAdvisorTLs] = useState<{ id: string; name: string; teamName: string }[]>([]);
const [advisorSelectedTLId, setAdvisorSelectedTLId] = useState<string | null>(null);
const [advisorMembers, setAdvisorMembers] = useState<{ id: string; name: string }[]>([]);
const [advisorSelectedAgentId, setAdvisorSelectedAgentId] = useState<string | null>(null);
const [advisorScoreData, setAdvisorScoreData] = useState<ScoreData | null>(null);
const [advisorLoading, setAdvisorLoading] = useState(false);
```

## Data Flow

1. **Tab açılır:**
   - ADMIN/MANAGER: `GET /api/teams` → TL listesini doldur (`advisorTLs`)
   - TEAM_LEADER: `GET /api/team/members` (leaderId olmadan) → `advisorMembers`'ı doldur

2. **TL seçilir (ADMIN/MANAGER):**
   - `advisorSelectedAgentId = null`, `advisorScoreData = null`
   - `GET /api/team/members?leaderId={advisorSelectedTLId}` → `advisorMembers`

3. **Danışman seçilir:**
   - `advisorLoading = true`
   - `GET /api/scores?agentId={advisorSelectedAgentId}` → `advisorScoreData`
   - `advisorLoading = false`

4. **TL değiştirilirse:** Danışman seçimi ve score sıfırlanır.

## API Endpoints Used

| Endpoint | Kullanım |
|----------|----------|
| `GET /api/teams` | TL listesi (ADMIN/MANAGER) |
| `GET /api/team/members?leaderId={id}` | TL'nin danışmanları (ADMIN/MANAGER) |
| `GET /api/team/members` | Kendi takım üyeleri (TEAM_LEADER) |
| `GET /api/scores?agentId={id}` | Seçili danışmanın ScoreData |

## Components Used

- `ScoreView` — mevcut, `canRefresh={true}` ile
- Tüm UI inline olarak LandingPage içinde, yeni dosya gerekmez

## canRefresh

ADMIN, MANAGER ve TEAM_LEADER her zaman refresh yapabilir → `canRefresh={true}` sabit.

## Empty & Loading States

- **TL seçilmedi (Admin/Manager):** Sol sütun TL listesini gösterir, sağda "← Bir danışman seçin"
- **TL seçildi, danışman seçilmedi:** Sol sütun danışman listesini gösterir, sağda aynı boş durum
- **Danışman seçildi, yükleniyor:** Sağda `advisorLoading` spinner (mevcut loading pattern)
- **Hata:** Score fetch başarısız → sağda hata mesajı

## Files Changed

| Dosya | İşlem |
|-------|-------|
| `app/components/LandingPage.tsx` | Modify — nav, state, data fetch, tab render |
