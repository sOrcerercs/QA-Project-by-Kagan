# Responsive Design Spec
**Date:** 2026-06-01  
**Status:** Approved

## Özet

Mevcut uygulama yalnızca desktop için tasarlanmış. Mobile (< 768px) ve iPad portrait (768–1024px) ekranlarında sidebar içeriği eziyor, landing header taşıyor, navigasyon kullanılamaz hale geliyor. Bu spec üç breakpoint için uyarlama tanımlar; desktop deneyimine dokunulmaz.

---

## Breakpoint Stratejisi

| Breakpoint | Aralık | Navigasyon |
|---|---|---|
| Mobile | < 768px | Bottom tab bar + Drawer |
| iPad Portrait | 768–1024px | 48px icon-only sidebar + hover/tap genişleme |
| Desktop | > 1024px | Mevcut — değişmez |

---

## 1. Landing Sayfası (Home Tab)

### Desktop (değişmez)
Mevcut cinematic tasarım olduğu gibi korunur: header + numbered nav, MetaRail, hero, stats strip, scroll indicator.

### Mobile (< 768px)
- **Header:** Logo + sağ kontroller (lang toggle, theme toggle) korunur. Numbered nav (`landingNav`) gizlenir.
- **MetaRail:** Gizlenir (`display: none`).
- **Hero:** Font boyutları küçülür (`heroH1` ~28px, `heroLede` ~13px). Tam ekran padding ayarlanır.
- **Stats strip:** Yatay scroll veya 3 eşit kolon grid olarak düzenlenir.
- **"Konsolu Aç" butonu:** Tam genişliğe (`width: 100%`) alınır.
- **Scroll indicator:** Gizlenir.
- **Bottom tab bar:** Her zaman ekranın altında sabit durur (landing dahil).

### iPad Portrait (768–1024px)
- Header numbered nav gizlenir, diğerleri kalır.
- MetaRail korunur.
- Stats strip korunur.
- Bottom tab bar gösterilmez; navigasyon sidebar drawer üzerinden çalışır.

---

## 2. Uygulama Shell (Sidebar + Topbar + İçerik)

### Desktop (değişmez)
Sol sidebar sabit, topbar üstte, içerik sağda.

### iPad Portrait (768–1024px)
- Sidebar 48px genişliğe küçülür; yalnızca ikonlar görünür, label'lar gizlenir.
- Sidebar üzerine tap yapınca tam genişliğe overlay olarak açılır, dışarı tıklanınca kapanır.
- Topbar korunur.
- İçerik alanı tam genişliği kullanır.

### Mobile (< 768px)
- **Sidebar:** Tamamen gizlenir. Ekranın dışına (`translateX(-100%)`) taşınır.
- **Drawer:** ☰ tıklandığında sidebar soldan kayarak açılır; backdrop overlay'e tıklanınca kapanır.
- **Topbar:** Yalnızca sayfa başlığı + 🔔 NotificationBell + avatar kalır. Search bar ve diğer kontroller gizlenir.
- **Bottom tab bar:** Ekranın altında sabit, rol bazlı 3 sekme + ☰ (drawer açar).
- **İçerik alanı:** Tam genişlik, alt tab bar yüksekliği kadar (`~60px`) padding-bottom alır.

---

## 3. Bottom Tab Bar — Rol Bazlı Sekmeler

| Rol | Sekme 1 | Sekme 2 | Sekme 3 | Sekme 4 |
|---|---|---|---|---|
| AGENT | 🏠 Ana | 📋 Değerlendirmeler | ⭐ Skorlarım | ☰ Menü |
| TEAM_LEADER | 🏠 Ana | 📋 Değerlendirmeler | 📊 Raporlar | ☰ Menü |
| ADMIN | 🏠 Ana | 📋 Değerlendirmeler | 📊 Raporlar | ☰ Menü |
| MANAGER | 🏠 Ana | 📋 Değerlendirmeler | 📊 Raporlar | ☰ Menü |

- Aktif sekme accent rengiyle vurgulanır.
- ☰ her zaman drawer'ı açar; drawer içinde tüm navigasyon item'ları listelenir.

---

## 4. Uygulama Kapsamı

### Birincil dosyalar
- `app/components/LandingPage.module.css` — tüm responsive CSS kuralları buraya eklenir (`@media` blokları)
- `app/components/LandingPage.tsx` — bottom tab bar bileşeni, drawer state, topbar mobil modu

### İkincil (küçük dokunuşlar)
- Bireysel component'lar (EvaluationList, ScoreView vb.) gerekirse kendi içinde `padding` / `font-size` ayarı alabilir — bu spec kapsamı dışında, ayrı geliştirme olarak ele alınır.

### Kapsam dışı
- Auth / login sayfası responsive uyarlaması
- Evaluation detail sayfası (`/evaluation/[id]`) responsive uyarlaması
- Bireysel component'ların derin responsive refactor'ı

---

## 5. Davranış Detayları

- **Drawer açık/kapalı state:** `LandingPage` içinde `useState` ile yönetilir. Sekme değişiminde otomatik kapanır.
- **Tab değişimi:** Bottom bar bir sekmeye tıklanınca mevcut `handleTab()` fonksiyonu çağrılır — ek state gerekmez.
- **iPad sidebar genişleme:** CSS `width` transition + hover/focus üzerinden; JS state gerekmeyebilir.
- **Safe area:** iPhone'da `env(safe-area-inset-bottom)` bottom bar'a uygulanır.
