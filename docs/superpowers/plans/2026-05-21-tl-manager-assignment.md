# TL → Manager Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Team Leader kullanıcılarına Manager atanabilsin — organizasyonel etiketleme; yetki ve rapor sınırları değişmez.

**Architecture:** `User` modeline opsiyonel self-referential `managerId` alanı eklenir. Manuel migration ile FK oluşturulur. GET/POST/PATCH `/api/users` endpoint'leri bu alanı destekleyecek şekilde güncellenir. Admin panelinde Add User ve Edit User formları TEAM_LEADER rolü seçildiğinde Manager dropdown'ı gösterir.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma (PostgreSQL + PrismaPg adapter), inline Tailwind CSS

---

## File Map

| Dosya | İşlem |
|-------|-------|
| `prisma/schema.prisma` | Modify — `managerId`, `manager`, `teamLeaders` alanları eklenir |
| `prisma/migrations/20260521100000_add_manager_tl/migration.sql` | Create — ALTER TABLE + FK |
| `app/lib/prisma.ts` | Modify — SCHEMA_VERSION bump |
| `app/api/users/route.ts` | Modify — GET: manager include; POST: managerId kabul + MANAGER guard |
| `app/api/users/[id]/route.ts` | Modify — PATCH: managerId kabul + MANAGER yetki kontrolü |
| `app/settings/admin/page.tsx` | Modify — i18n, state, handler logic, Add/Edit form JSX |

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260521100000_add_manager_tl/migration.sql`

- [ ] **Step 1: `prisma/schema.prisma` dosyasını oku**

Şu anki User modeli (satır 32–51 civarı):
```prisma
model User {
  id            String         @id @default(cuid())
  name          String
  email         String         @unique
  passwordHash  String
  role          Role           @default(AGENT)
  teamId        String?
  team          Team?          @relation("TeamMembers", fields: [teamId], references: [id])
  leadingTeam   Team?          @relation("TeamLeader")
  evaluations   Evaluation[]   @relation("EvaluatedAgent")
  activityLogs  ActivityLog[]
  feedbacks     Feedback[]
  notifications Notification[]
  createdAt     DateTime       @default(now())
  lastLoginAt   DateTime?
}
```

- [ ] **Step 2: User modeline `managerId` / `manager` / `teamLeaders` alanlarını ekle**

`lastLoginAt   DateTime?` satırından **sonrasına** ekle:
```prisma
  managerId     String?
  manager       User?          @relation("ManagerTL", fields: [managerId], references: [id], onDelete: SetNull)
  teamLeaders   User[]         @relation("ManagerTL")
```

Sonuçta User modeli şöyle görünmeli:
```prisma
model User {
  id            String         @id @default(cuid())
  name          String
  email         String         @unique
  passwordHash  String
  role          Role           @default(AGENT)
  teamId        String?
  team          Team?          @relation("TeamMembers", fields: [teamId], references: [id])
  leadingTeam   Team?          @relation("TeamLeader")
  evaluations   Evaluation[]   @relation("EvaluatedAgent")
  activityLogs  ActivityLog[]
  feedbacks     Feedback[]
  notifications Notification[]
  createdAt     DateTime       @default(now())
  lastLoginAt   DateTime?
  managerId     String?
  manager       User?          @relation("ManagerTL", fields: [managerId], references: [id], onDelete: SetNull)
  teamLeaders   User[]         @relation("ManagerTL")
}
```

- [ ] **Step 3: Migration SQL dosyasını oluştur**

Yeni dosya: `prisma/migrations/20260521100000_add_manager_tl/migration.sql`

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "managerId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Prisma client yeniden üret**

```bash
cd /Users/sorcerer/sdr-analyzer && npx prisma generate 2>&1
```

Expected: "Generated Prisma Client" içeren başarı çıktısı, hata yok.

- [ ] **Step 5: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -30
```

Expected: Hata yok.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260521100000_add_manager_tl/
git commit -m "feat: add managerId self-referential relation to User schema"
```

---

## Task 2: SCHEMA_VERSION Bump

**Files:**
- Modify: `app/lib/prisma.ts`

- [ ] **Step 1: `app/lib/prisma.ts` dosyasını oku**

Satır 10'da şu satırı bul:
```typescript
const SCHEMA_VERSION = "v7-coaching-summary";
```

- [ ] **Step 2: SCHEMA_VERSION güncelle**

`"v7-coaching-summary"` değerini `"v8-tl-manager-assignment"` ile değiştir:
```typescript
const SCHEMA_VERSION = "v8-tl-manager-assignment";
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Expected: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/lib/prisma.ts
git commit -m "feat: bump SCHEMA_VERSION to v8-tl-manager-assignment"
```

---

## Task 3: GET /api/users — `manager` alanını döndür

**Files:**
- Modify: `app/api/users/route.ts`

Mevcut GET handler:
```typescript
const users = await prisma.user.findMany({
  include: { team: true },
  orderBy: { name: "asc" },
});
```

- [ ] **Step 1: `app/api/users/route.ts` dosyasını oku**

- [ ] **Step 2: GET handler'ı güncelle — `manager` include ekle**

`include: { team: true }` satırını şu şekilde değiştir:
```typescript
    include: {
      team: true,
      manager: { select: { id: true, name: true } },
    },
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Expected: Hata yok.

- [ ] **Step 4: Commit**

```bash
git add app/api/users/route.ts
git commit -m "feat: GET /api/users returns manager: {id, name} for TL users"
```

---

## Task 4: POST /api/users — `managerId` kabul et

**Files:**
- Modify: `app/api/users/route.ts`

Mevcut POST handler başı:
```typescript
const { name, email, password, role, teamId, leaderId } = await req.json();
```
ve
```typescript
const newUser = await prisma.user.create({
  data: { name, email, passwordHash, role, teamId: resolvedTeamId },
});
```

- [ ] **Step 1: `app/api/users/route.ts` dosyasını oku (Task 3'te zaten okunduysa atla)**

- [ ] **Step 2: destructure'a `managerId` ekle**

`const { name, email, password, role, teamId, leaderId } = await req.json();` satırını değiştir:
```typescript
  const { name, email, password, role, teamId, leaderId, managerId } = await req.json();
```

- [ ] **Step 3: MANAGER yetki kontrolü ekle**

`const passwordHash = await bcrypt.hash(password, 10);` satırından **önce** ekle:
```typescript
  // MANAGER can only assign themselves as manager for a TL
  if (
    currentUser.role === "MANAGER" &&
    managerId !== undefined &&
    managerId !== null &&
    managerId !== currentUser.id
  ) {
    return NextResponse.json({ error: "Yöneticiler yalnızca kendilerini atayabilir." }, { status: 403 });
  }
```

- [ ] **Step 4: `prisma.user.create`'e `managerId` ekle**

`data: { name, email, passwordHash, role, teamId: resolvedTeamId }` satırını değiştir:
```typescript
    data: {
      name,
      email,
      passwordHash,
      role,
      teamId: resolvedTeamId,
      managerId: role === "TEAM_LEADER" ? (managerId ?? null) : null,
    },
```

- [ ] **Step 5: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Expected: Hata yok.

- [ ] **Step 6: Commit**

```bash
git add app/api/users/route.ts
git commit -m "feat: POST /api/users accepts managerId for TEAM_LEADER with MANAGER guard"
```

---

## Task 5: PATCH /api/users/[id] — `managerId` kabul et

**Files:**
- Modify: `app/api/users/[id]/route.ts`

Mevcut PATCH body destructure:
```typescript
const { name, email, role, teamId, newPassword } = body as {
  name?: string;
  email?: string;
  role?: string;
  teamId?: string | null;
  newPassword?: string;
};
```

- [ ] **Step 1: `app/api/users/[id]/route.ts` dosyasını oku**

- [ ] **Step 2: body type'a `managerId` ekle**

Destructure ve type'ı değiştir:
```typescript
  const { name, email, role, teamId, newPassword, managerId } = body as {
    name?: string;
    email?: string;
    role?: string;
    teamId?: string | null;
    newPassword?: string;
    managerId?: string | null;
  };
```

- [ ] **Step 3: MANAGER yetki kontrolü ekle**

`const updates: Record<string, unknown> = {};` satırından **önce** ekle:
```typescript
  // MANAGER can only assign themselves as manager (any other value including null is rejected)
  if (admin.role === "MANAGER" && managerId !== undefined && managerId !== admin.id) {
    return NextResponse.json({ error: "Yöneticiler yalnızca kendilerini atayabilir." }, { status: 403 });
  }
```

- [ ] **Step 4: `updates` objesine `managerId` ekle**

`if (teamId !== undefined) updates.teamId = teamId || null;` satırından **sonrasına** ekle:
```typescript
  if (managerId !== undefined) updates.managerId = managerId;
```

- [ ] **Step 5: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Expected: Hata yok.

- [ ] **Step 6: Commit**

```bash
git add app/api/users/[id]/route.ts
git commit -m "feat: PATCH /api/users/[id] accepts managerId with MANAGER auth guard"
```

---

## Task 6: Admin UI — i18n strings, state, handler logic

**Files:**
- Modify: `app/settings/admin/page.tsx`

- [ ] **Step 1: `app/settings/admin/page.tsx` dosyasını oku (satır 1–210)**

- [ ] **Step 2: `ADMIN_T.tr`'ye i18n string ekle**

`ADMIN_T.tr` içinde `selectTeamLeader: "— Takım lideri seçin —",` satırından **sonrasına** ekle:
```typescript
    selectManager: "— Manager seçin —",
    managerLabel: "Manager (opsiyonel)",
    noManager: "Atama yok",
```

- [ ] **Step 3: `ADMIN_T.en`'e i18n string ekle**

`ADMIN_T.en` içinde `selectTeamLeader: "— Select team leader —",` satırından **sonrasına** ekle:
```typescript
    selectManager: "— Select manager —",
    managerLabel: "Manager (optional)",
    noManager: "No assignment",
```

- [ ] **Step 4: Add User form state değişkeni ekle**

`const [newLeaderId, setNewLeaderId] = useState("");` satırından **sonrasına** ekle:
```typescript
  const [newManagerId, setNewManagerId] = useState("");
```

- [ ] **Step 5: Edit User form state değişkeni ekle**

`const [editTeamId, setEditTeamId] = useState("");` satırından **sonrasına** ekle:
```typescript
  const [editManagerId, setEditManagerId] = useState("");
```

- [ ] **Step 6: `handleUserRowClick`'te `editManagerId` başlat**

`handleUserRowClick` içinde `setEditTeamId(u.teamId || u.team?.id || "");` satırından **sonrasına** ekle:
```typescript
    setEditManagerId(u.managerId || "");
```

- [ ] **Step 7: `newRole` onChange'de `newManagerId` sıfırla**

Satır ~719'daki `onChange` handler:
```tsx
onChange={(e) => { setNewRole(e.target.value); if (e.target.value !== "AGENT") setNewLeaderId(""); }}
```
Şu şekilde değiştir:
```tsx
onChange={(e) => {
  setNewRole(e.target.value);
  if (e.target.value !== "AGENT") setNewLeaderId("");
  if (e.target.value !== "TEAM_LEADER") setNewManagerId("");
}}
```

- [ ] **Step 8: `editRole` onChange'de `editManagerId` sıfırla**

Satır ~835'teki `onChange` handler:
```tsx
onChange={(e) => { setEditRole(e.target.value); if (e.target.value !== "AGENT") setEditTeamId(""); setEditMsg(""); setEditStatus("idle"); }}
```
Şu şekilde değiştir:
```tsx
onChange={(e) => {
  setEditRole(e.target.value);
  if (e.target.value !== "AGENT") setEditTeamId("");
  if (e.target.value !== "TEAM_LEADER") setEditManagerId("");
  setEditMsg("");
  setEditStatus("idle");
}}
```

- [ ] **Step 9: `handleAddUser`'da `managerId` gönder**

`handleAddUser` içinde `body: JSON.stringify(...)` satırını bul:
```typescript
      body: JSON.stringify({ name: newName, email: newEmail, password: newPassword, role: newRole, leaderId: newLeaderId || null }),
```
Şu şekilde değiştir:
```typescript
      body: JSON.stringify({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
        leaderId: newLeaderId || null,
        managerId: newRole === "TEAM_LEADER" ? (newManagerId || null) : undefined,
      }),
```

Ayrıca reset bloğunda `setNewLeaderId("");` satırından **sonrasına** ekle:
```typescript
    setNewManagerId("");
```

- [ ] **Step 10: `handleSaveUser`'da `managerId` gönder**

`handleSaveUser` içinde `const body: any = { ... }` bloğunu bul:
```typescript
    const body: any = {
      name: editName,
      email: editEmail,
      role: editRole,
      teamId: editTeamId || null,
    };
    if (editNewPassword) body.newPassword = editNewPassword;
```
Şu şekilde değiştir:
```typescript
    const body: any = {
      name: editName,
      email: editEmail,
      role: editRole,
      teamId: editTeamId || null,
    };
    if (editRole === "TEAM_LEADER") body.managerId = editManagerId || null;
    if (editNewPassword) body.newPassword = editNewPassword;
```

- [ ] **Step 11: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Expected: Hata yok.

- [ ] **Step 12: Commit**

```bash
git add app/settings/admin/page.tsx
git commit -m "feat: admin UI — manager state, i18n, handler logic for managerId"
```

---

## Task 7: Admin UI — Add User formuna Manager dropdown ekle

**Files:**
- Modify: `app/settings/admin/page.tsx`

- [ ] **Step 1: `managers` ve `managerOptions` computed değişkenlerini ekle**

`return (` satırından **hemen önce** (component'in en alt kısmında, JSX başlamadan önce) ekle:
```typescript
  const managers = users.filter((u: any) => u.role === "MANAGER");
  const managerOptions =
    user?.role === "MANAGER"
      ? managers.filter((m: any) => m.id === user.id)
      : managers;
```

- [ ] **Step 2: Add User formunu oku**

Satır ~728'i oku. `{newRole === "AGENT" && (` bloğunu bul:
```tsx
{newRole === "AGENT" && (
  <div className="md:col-span-2">
    <label className="text-xs text-on-surface-variant font-semibold block mb-1">{t.team}</label>
    <select
      value={newLeaderId}
      onChange={(e) => setNewLeaderId(e.target.value)}
      ...
    >
      ...
    </select>
  </div>
)}
```

- [ ] **Step 3: Manager dropdown'ı ekle**

`{newRole === "AGENT" && (...)}` bloğunun kapanan `)}` satırından **hemen sonrasına** ekle:
```tsx
{newRole === "TEAM_LEADER" && (
  <div className="md:col-span-2">
    <label className="text-xs text-on-surface-variant font-semibold block mb-1">
      {t.managerLabel}
    </label>
    <select
      value={newManagerId}
      onChange={(e) => setNewManagerId(e.target.value)}
      className="w-full bg-surface-container-lowest rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
    >
      <option value="">{t.selectManager}</option>
      {managerOptions.map((m: any) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 4: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Expected: Hata yok.

- [ ] **Step 5: Commit**

```bash
git add app/settings/admin/page.tsx
git commit -m "feat: admin UI Add User form — Manager dropdown for TEAM_LEADER role"
```

---

## Task 8: Admin UI — Edit User formuna Manager dropdown ekle + kullanıcı listesinde manager göster

**Files:**
- Modify: `app/settings/admin/page.tsx`

- [ ] **Step 1: Edit User formunu oku**

Satır ~844'ü oku. `{editRole === "AGENT" && (` bloğunu bul:
```tsx
{editRole === "AGENT" && (
  <div>
    <label ...>{t.team}</label>
    <select value={editTeamId} ...>
      ...
    </select>
  </div>
)}
```

- [ ] **Step 2: Manager dropdown'ı ekle**

`{editRole === "AGENT" && (...)}` bloğunun kapanan `)}` satırından **hemen sonrasına** ekle:
```tsx
{editRole === "TEAM_LEADER" && (
  <div>
    <label className="text-xs text-on-surface-variant font-semibold block mb-1">
      {t.managerLabel}
    </label>
    <select
      value={editManagerId}
      onChange={(e) => { setEditManagerId(e.target.value); setEditMsg(""); setEditStatus("idle"); }}
      className="w-full bg-surface-container rounded-xl px-4 py-2.5 text-sm text-on-surface border border-outline-variant focus:outline-none focus:ring-1 focus:ring-primary transition-all"
    >
      <option value="">{t.noManager}</option>
      {managerOptions.map((m: any) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  </div>
)}
```

- [ ] **Step 3: Kullanıcı listesinde manager adını göster**

Satır ~785'teki kullanıcı satırı subtitle:
```tsx
<p className="text-xs text-on-surface-variant">{u.email}{u.team ? ` · ${u.team.name}` : ""}</p>
```
Şu şekilde değiştir:
```tsx
<p className="text-xs text-on-surface-variant">
  {u.email}
  {u.team ? ` · ${u.team.name}` : ""}
  {u.role === "TEAM_LEADER" && u.manager ? ` · ${u.manager.name}` : ""}
</p>
```

- [ ] **Step 4: TypeScript kontrolü**

```bash
cd /Users/sorcerer/sdr-analyzer && npx tsc --noEmit 2>&1 | head -20
```

Expected: Hata yok.

- [ ] **Step 5: Commit**

```bash
git add app/settings/admin/page.tsx
git commit -m "feat: admin UI Edit User form — Manager dropdown + manager name in user list"
```

---

## Self-Review

### Spec Coverage

| Spec Gereksinimi | Task |
|---|---|
| `managerId`, `manager`, `teamLeaders` schema alanları | Task 1 |
| Migration: ALTER TABLE + FK ON DELETE SET NULL | Task 1 |
| SCHEMA_VERSION bump "v8-tl-manager-assignment" | Task 2 |
| GET /api/users: `manager: { id, name }` | Task 3 |
| POST /api/users: managerId kabul + MANAGER sadece kendi id'sini | Task 4 |
| PATCH /api/users/[id]: managerId kabul + MANAGER 403 guard | Task 5 |
| Add User formunda TEAM_LEADER seçilince Manager dropdown belirir | Task 7 |
| ADMIN: tüm Manager'ları görür | Task 7 |
| MANAGER: sadece kendi adını görür (managerOptions filter) | Task 7 |
| Edit User formunda TEAM_LEADER için Manager dropdown | Task 8 |
| Mevcut managerId pre-selected (handleUserRowClick'te initialize) | Task 6 |
| Edit formunda ADMIN: "Atama yok" seçeneği (noManager option value="") | Task 8 |
| Edit formunda MANAGER: "Atama yok" + kendi adı | Task 8 |

### Placeholder Tarama

Tüm adımlar gerçek kod içeriyor. TBD/TODO yok.

### Type Tutarlılığı

- `managerId`: `String?` Prisma schema → `string | null | undefined` TypeScript → uyumlu
- `manager` include: `{ select: { id: true, name: true } }` → `{ id: string; name: string } | null` → UI `u.manager?.name` uyumlu
- `managerOptions`: `any[]` (users state `any[]` olduğundan) — uyumlu
- `newManagerId` / `editManagerId`: `string` (boş = seçilmedi) → `|| null` ile null'a dönüşür
- `managerId !== undefined` MANAGER guard: POST'ta `managerId` undefined olduğunda guard bypass → doğru
- `body.managerId` yalnızca `editRole === "TEAM_LEADER"` için set edilir → non-TL kullanıcı editinde MANAGER guard tetiklenmez
