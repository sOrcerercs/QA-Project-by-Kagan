# Advisor Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADMIN, MANAGER ve TEAM_LEADER rollerine sidebar'da "Danışman Paneli" sekmesi ekle; sol panel seçici (TL → danışman veya direkt danışman), sağ panel seçilen danışmanın ScoreView'u.

**Architecture:** Tek dosya değişikliği: `app/components/LandingPage.tsx`. Mevcut `/api/teams`, `/api/team/members`, `/api/scores` endpoint'leri yeterli; yeni backend kodu yok. Tüm state, fetcher ve JSX mevcut `teamreports` pattern'ını takip eder.

**Tech Stack:** Next.js 15 App Router, React, TypeScript, inline CSS vars (`var(--glass-bg)`, `var(--accent)` vb.), CSS Modules (`LandingPage.module.css`)

---

## File Map

| Dosya | İşlem |
|-------|-------|
| `app/components/LandingPage.tsx` | Modify — NAV_LABELS, state, fetchers, handleTab, mainNavItems, tab JSX |

---

## Task 1: Foundation — NAV_LABELS, state, fetchers, handleTab, mainNavItems

**Files:**
- Modify: `app/components/LandingPage.tsx`

Tüm bu değişiklikler saf veri/mantık düzeyindedir; UI henüz render edilmez ama TypeScript hatasız compile etmeli.

- [ ] **Step 1: `app/components/LandingPage.tsx` dosyasını oku**

Tüm dosyayı oku ve aşağıdaki satırları bul:
- `NAV_LABELS` bloğu (satır ~32-53) — TR ve EN label'ları
- State bildirimleri bloğu (satır ~182-236) — `useState` listesi
- Fetcher fonksiyonları (satır ~264-390) — `fetchTeamReportMembers` civarı
- `handleTab` fonksiyonu (satır ~326-339)
- `mainNavItems` array'i (satır ~548-570)

- [ ] **Step 2: NAV_LABELS'a `advisor` ekle**

TR bloğunda `leaderboard: "Sıralama",` satırından **sonra**:
```typescript
    advisor: "Danışman Paneli",
```

EN bloğunda `leaderboard: "Rankings",` satırından **sonra**:
```typescript
    advisor: "Advisor Dashboard",
```

- [ ] **Step 3: Advisor state değişkenlerini ekle**

"team reports" state bloğunun (satır ~221-236) hemen **sonrasına** ekle:

```typescript
  /* advisor dashboard */
  const [advisorTLs, setAdvisorTLs] = useState<{ id: string; name: string; teamName: string }[]>([]);
  const [advisorSelectedTLId, setAdvisorSelectedTLId] = useState<string | null>(null);
  const [advisorMembers, setAdvisorMembers] = useState<{ id: string; name: string }[]>([]);
  const [advisorSelectedAgentId, setAdvisorSelectedAgentId] = useState<string | null>(null);
  const [advisorScoreData, setAdvisorScoreData] = useState<any>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
```

- [ ] **Step 4: Advisor fetcher fonksiyonlarını ekle**

`fetchTeamReportMembers` fonksiyonunun (satır ~361-367) hemen **sonrasına** ekle:

```typescript
  const fetchAdvisorTLs = async () => {
    const res = await fetch("/api/teams");
    if (!res.ok) return;
    const data = await res.json();
    setAdvisorTLs(
      (data.teams || [])
        .filter((t: any) => t.leader)
        .map((t: any) => ({ id: t.leader.id, name: t.leader.name, teamName: t.name }))
    );
  };

  const fetchAdvisorMembers = async (leaderId?: string) => {
    const url = leaderId ? `/api/team/members?leaderId=${leaderId}` : "/api/team/members";
    const res = await fetch(url);
    if (res.ok) setAdvisorMembers((await res.json()).members || []);
  };

  const fetchAdvisorScore = async (agentId: string) => {
    setAdvisorLoading(true);
    setAdvisorScoreData(null);
    const res = await fetch(`/api/scores?agentId=${agentId}`);
    if (res.ok) setAdvisorScoreData(await res.json());
    setAdvisorLoading(false);
  };
```

- [ ] **Step 5: `handleTab` içine advisor trigger ekle**

`handleTab` fonksiyonunda (satır ~326-339) şu satırı:
```typescript
    if (tab === "scores" && !scoresData && !scoresLoading) fetchScores(scoresAgent || undefined);
```
Bu satırdan **sonrasına** ekle:
```typescript
    if (tab === "advisor") {
      if (isManagerLike && advisorTLs.length === 0) fetchAdvisorTLs();
      if (user.role === "TEAM_LEADER" && advisorMembers.length === 0) fetchAdvisorMembers();
    }
```

- [ ] **Step 6: `mainNavItems`'a advisor ekle**

`mainNavItems.push({ key: "leaderboard", icon: "trophy" });` satırından **sonrasına** ekle:

```typescript
  if (isManagerLike || user.role === "TEAM_LEADER") {
    mainNavItems.push({ key: "advisor", icon: "users" });
  }
```

- [ ] **Step 7: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1
```

Expected: Hata yok.

- [ ] **Step 8: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: advisor dashboard — nav, state, fetchers, handleTab"
```

---

## Task 2: Advisor Dashboard tab JSX render

**Files:**
- Modify: `app/components/LandingPage.tsx`

- [ ] **Step 1: Dosyayı oku**

Dosyanın son kısmını oku (satır ~2040-2072). Şu bloğu bul:

```tsx
            {activeTab === "admin" && (user.role === "ADMIN" || user.role === "MANAGER") && (
              <AdminPanel user={user} lang={lang} />
            )}

          </div>
        </div>
      </div>
      )}
```

- [ ] **Step 2: Advisor tab JSX'ini ekle**

`{activeTab === "admin" && ...}` bloğundan **hemen sonra**, `</div>` kapanışlarından **önce** ekle:

```tsx
            {/* ── ADVISOR DASHBOARD ── */}
            {activeTab === "advisor" && (isManagerLike || user.role === "TEAM_LEADER") && (
              <div className={styles.page}>
                <div className={styles.pageHd}>
                  <h1 className={styles.pageH1}>{navLabels.advisor}</h1>
                  <p className={styles.pageSub}>
                    {lang === "tr"
                      ? "Danışman bazında skor ve gelişim takibi"
                      : "Score and development tracking per advisor"}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                  {/* ── Left panel — selectors ── */}
                  <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>

                    {/* TL list — Admin & Manager only */}
                    {isManagerLike && (
                      <>
                        <div className={styles.sectHd}>
                          <h2 className={styles.sectH2}>
                            {lang === "tr" ? "Takım Lideri" : "Team Leader"}
                          </h2>
                        </div>
                        {advisorTLs.length === 0 && (
                          <p style={{ fontSize: 13, color: "var(--fg-faint)", padding: "8px 0" }}>
                            {lang === "tr" ? "Takım bulunamadı." : "No teams found."}
                          </p>
                        )}
                        {advisorTLs.map(tl => (
                          <button
                            key={tl.id}
                            onClick={() => {
                              if (advisorSelectedTLId === tl.id) return;
                              setAdvisorSelectedTLId(tl.id);
                              setAdvisorSelectedAgentId(null);
                              setAdvisorScoreData(null);
                              setAdvisorMembers([]);
                              fetchAdvisorMembers(tl.id);
                            }}
                            style={{
                              display: "block", width: "100%", textAlign: "left",
                              padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                              border: advisorSelectedTLId === tl.id
                                ? "1px solid var(--accent)"
                                : "1px solid var(--glass-border)",
                              background: advisorSelectedTLId === tl.id
                                ? "rgba(59,130,246,.12)"
                                : "var(--glass-bg)",
                              color: advisorSelectedTLId === tl.id ? "var(--accent)" : "var(--fg)",
                              fontSize: 13, fontWeight: 500,
                            }}
                          >
                            {tl.name}
                            <span style={{ display: "block", fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
                              {tl.teamName}
                            </span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Agent list — shown when TL selected (Admin/Manager) or always (TL) */}
                    {(advisorSelectedTLId !== null || user.role === "TEAM_LEADER") && (
                      <>
                        <div className={styles.sectHd} style={{ marginTop: isManagerLike ? 16 : 0 }}>
                          <h2 className={styles.sectH2}>
                            {lang === "tr" ? "Danışman" : "Advisor"}
                          </h2>
                        </div>
                        {advisorMembers.length === 0 && (
                          <p style={{ fontSize: 13, color: "var(--fg-faint)", padding: "8px 0" }}>
                            {lang === "tr" ? "Danışman bulunamadı." : "No advisors found."}
                          </p>
                        )}
                        {advisorMembers.map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setAdvisorSelectedAgentId(m.id);
                              fetchAdvisorScore(m.id);
                            }}
                            style={{
                              display: "block", width: "100%", textAlign: "left",
                              padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                              border: advisorSelectedAgentId === m.id
                                ? "1px solid var(--accent)"
                                : "1px solid var(--glass-border)",
                              background: advisorSelectedAgentId === m.id
                                ? "rgba(59,130,246,.12)"
                                : "var(--glass-bg)",
                              color: advisorSelectedAgentId === m.id ? "var(--accent)" : "var(--fg)",
                              fontSize: 13, fontWeight: 500,
                            }}
                          >
                            {m.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  {/* ── Right panel — ScoreView ── */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {advisorLoading && (
                      <div className={`${styles.card} ${styles.spinner}`}><div /></div>
                    )}
                    {!advisorLoading && advisorScoreData && (
                      <ScoreView data={advisorScoreData} lang={lang} canRefresh={true} />
                    )}
                    {!advisorLoading && !advisorScoreData && (
                      <div className={styles.emptyMsg}>
                        {lang === "tr" ? "← Bir danışman seçin" : "← Select an advisor"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1
```

Expected: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/components/LandingPage.tsx
git commit -m "feat: advisor dashboard tab — two-column selector + ScoreView"
```

---

## Self-Review

### Spec coverage

| Spec Gereksinimi | Task |
|---|---|
| `advisor` NAV_LABELS TR + EN | Task 1, Step 2 |
| 6 state değişkeni | Task 1, Step 3 |
| `fetchAdvisorTLs` — `/api/teams` | Task 1, Step 4 |
| `fetchAdvisorMembers` — `/api/team/members` | Task 1, Step 4 |
| `fetchAdvisorScore` — `/api/scores?agentId` | Task 1, Step 4 |
| handleTab trigger (isManagerLike + TL) | Task 1, Step 5 |
| mainNavItems: isManagerLike OR TL | Task 1, Step 6 |
| TL listesi — sadece Admin/Manager | Task 2, Step 2 |
| Agent listesi — TL seçilince veya TL rolü | Task 2, Step 2 |
| Seçili öğe vurgusu (`var(--accent)`) | Task 2, Step 2 |
| ScoreView sağ panelde | Task 2, Step 2 |
| `canRefresh={true}` | Task 2, Step 2 |
| Loading spinner | Task 2, Step 2 |
| Empty state metni | Task 2, Step 2 |

### Placeholder tarama

Tüm adımlarda gerçek kod verilmiştir. TBD/TODO yok.

### Type tutarlılığı

- `advisorTLs`: `{ id, name, teamName }[]` — Task 1 state, Task 1 fetcher, Task 2 JSX uyumlu
- `advisorMembers`: `{ id, name }[]` — Task 1 state, Task 1 fetcher, Task 2 JSX uyumlu
- `advisorScoreData`: `any` — `scoresData` ile aynı tip, `ScoreView` bununla çalışıyor
- `advisorSelectedTLId`: `string | null` — Task 1 state, Task 2 null kontrolü uyumlu
