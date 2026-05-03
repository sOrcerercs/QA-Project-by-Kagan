# Danışman Portalı — Tasarım Dokümanı

**Tarih:** 2026-04-20  
**Proje:** SDR Analyzer — ESTENOVE  
**Kapsam:** Rol bazlı danışman/takım lideri portal görünümü

---

## Genel Bakış

Mevcut uygulama tek bir `page.tsx` üzerinden çalışmakta ve admin odaklı tasarlanmıştır. Bu tasarım; AGENT ve TEAM_LEADER rolündeki kullanıcıların sadece kendi verilerine erişebildiği, yönetimsel hiçbir yetkiye sahip olmadığı, ayrı dashboard bileşenleriyle yönetilen bir portal katmanı ekler.

Giriş URL'i değişmez (`/`). Login sonrası kullanıcının rolüne göre uygun dashboard bileşeni render edilir.

---

## Mimari

### Dosya Yapısı

```
app/
├── page.tsx                            ← Thin router: role'e göre dashboard seçer
├── components/
│   ├── dashboards/
│   │   ├── AdminDashboard.tsx          ← Mevcut page.tsx içeriği taşınır (ADMIN + MANAGER)
│   │   ├── AgentDashboard.tsx          ← Yeni: AGENT görünümü
│   │   └── TeamLeaderDashboard.tsx     ← Yeni: TEAM_LEADER görünümü
│   └── shared/
│       ├── KPISummary.tsx              ← Ortak KPI kartları
│       ├── EvaluationList.tsx          ← Ortak değerlendirme listesi
│       ├── ScoreCard.tsx               ← Ortak skor kartı
│       ├── ReportsView.tsx             ← Ortak raporlar bölümü
│       ├── TeamMemberPicker.tsx        ← TL çoklu danışman seçimi (checkbox)
│       └── DateRangePicker.tsx         ← TL tarih aralığı filtresi
```

### Yönlendirme Akışı

```
GET / → page.tsx
  → /api/auth/me
    → token geçersiz/yok       → /login
    → role === AGENT            → <AgentDashboard>
    → role === TEAM_LEADER      → <TeamLeaderDashboard>
    → role === MANAGER/ADMIN    → <AdminDashboard>
```

---

## Bileşenler

### AgentDashboard

Danışman kendi verilerini aşağıdaki sekmeler üzerinden görür:

| Sekme | İçerik |
|---|---|
| Ana Sayfa | KPI özeti: ortalama skor, performans derecesi, toplam arama sayısı, en yüksek skor |
| Aramalar | Kendi değerlendirme listesi; arama detayına tıklanabilir |
| Skorlar | Kendi skor geçmişi ve grafiği |
| Raporlar | Kendi raporları |

Tüm veriler JWT token'daki `userId` ile otomatik filtrelenir. Danışman başka kullanıcının verisine erişemez.

---

### TeamLeaderDashboard

AgentDashboard'daki 4 sekmenin tamamına ek olarak **"Takımım"** sekmesi içerir:

| Alt Bölüm | İçerik |
|---|---|
| Takım Özeti | Tüm takımın ortalama KPI kartları |
| Danışman Seçici | `TeamMemberPicker`: checkbox listesi, çoklu seçim |
| Tarih Aralığı | `DateRangePicker`: başlangıç–bitiş tarihi filtresi |
| Karşılaştırma | Seçili danışmanların skorları yan yana grafik/tablo |
| Danışman Detay | Bir danışmana tıklanınca o kişinin KPI + değerlendirme + rapor bilgileri overlay modal olarak açılır |

Takım lideri sadece kendi takımındaki (`teamId`) danışmanların verisine erişebilir.

---

### AdminDashboard

Mevcut `page.tsx` içeriğinin tamamı bu bileşene taşınır. Hiçbir işlevsel değişiklik yapılmaz.

---

## API Değişiklikleri

### Mevcut Endpoint'lere Eklenen Query Parametreleri

| Endpoint | Yeni Parametre | Açıklama |
|---|---|---|
| `GET /api/evaluations` | `agentIds`, `startDate`, `endDate` | TL çoklu filtre + tarih aralığı |
| `GET /api/scores` | `agentIds`, `startDate`, `endDate` | TL karşılaştırma görünümü |

**Güvenlik:** TEAM_LEADER rolünde gelen `agentIds` parametresi, API tarafında `user.teamId` ile karşılaştırılır. Takım dışı bir ID istenirse `403 Forbidden` döner.

---

### Yeni Endpoint

**`GET /api/team/members`**
- Yetki: TEAM_LEADER
- Token'dan `teamId` alır
- Takımdaki tüm kullanıcıları döner: `{ id, name, role }`
- `TeamMemberPicker` bileşeni bu listeyi kullanır

---

### Değişmeyen Endpoint'ler

- `POST /api/users` — Admin şifreyle kullanıcı oluşturma (zaten çalışıyor)
- `GET /api/auth/me` — Role bilgisi zaten dönüyor
- `POST /api/analyze`, `POST /api/batch` — Danışman/TL görünümünde çağrılmaz

---

## Şifre Yönetimi

Başlangıç aşamasında admin şifreyi doğrudan belirler:

- Admin panelinde kullanıcı oluştururken şifre alanı eklenir
- Şifre bcrypt ile hashlenir
- Kullanıcıya e-posta + şifre manuel iletilir
- Mevcut `POST /api/users` endpoint'i bu akışı destekler; sadece frontend'e şifre alanı eklenmesi gerekir

---

## Güvenlik

### Çift Katman Koruma

1. **Frontend:** Role göre bileşen seçilir — admin sekmeleri AGENT/TEAM_LEADER DOM'una hiç girmez
2. **Backend:** Her API isteği token doğrular, role göre veri kısıtlanır — frontend'den bağımsız olarak koruma sağlar

### Yönlendirme

- Token yoksa veya geçersizse → `/login`
- Role uygun dashboard render edilir, diğer roller içeriğe hiç ulaşamaz

---

## Kapsam Dışı (Bu Sürüm)

- Şifre sıfırlama / davet linki akışı
- E-posta bildirimleri
- Danışmanın kendi şifresini değiştirmesi
- Admin dışı rollerin kullanıcı oluşturması

---

## Başarı Kriterleri

- AGENT girişi yapıp sadece kendi KPI/değerlendirme/skor/raporlarını görür
- TEAM_LEADER kendi verilerine ek olarak takım üyelerini seçip karşılaştırabilir
- MANAGER/ADMIN mevcut tam görünüme ulaşır, hiçbir kırılma olmaz
- Danışman herhangi bir API çağrısıyla başka kullanıcının verisine erişemez
