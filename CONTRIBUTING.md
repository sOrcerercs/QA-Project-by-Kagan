# Katkı ve Dağıtım Kuralları

Bu proje **Vercel (Hobby planı)** üzerinde, **Supabase Postgres** ile çalışır.
Aşağıdaki kurallar, geçmişte yaşanan tekrarlayan build/deploy hatalarını önlemek
içindir. Lütfen yeni iş yaparken bunlara uyun.

## 1. Branch açarken

- **Her zaman güncel `main`'den branch açın.** Eski bir koldan açılan branch,
  daha önce main'e girmiş build düzeltmelerini kaybeder ve deploy'u tekrar
  bozar.

  ```bash
  git checkout main && git pull
  git checkout -b feat/yeni-ozellik
  ```

## 2. Build kısıtları (Vercel'de patlamamak için)

Bu üç kural daha önce build'i çökerttiği için kritiktir:

1. **Prisma import yolu** — Prisma Client ve tipleri `@/app/generated/prisma`
   üzerinden import edilir, **`@prisma/client`'tan DEĞİL**. Schema'da
   `output = "../app/generated/prisma"` ayarlı olduğu için `@prisma/client`
   paketinde generate edilmiş client bulunmaz ve build hata verir.

   ```ts
   // ✅ Doğru
   import { Prisma, $Enums } from "@/app/generated/prisma";
   // ❌ Yanlış — build patlar
   import { Prisma, $Enums } from "@prisma/client";
   ```

2. **`useSearchParams` + Suspense** — `useSearchParams()` kullanan bir client
   sayfası, bir `<Suspense>` sınırına alınmalıdır. Aksi halde prerender
   sırasında `Missing Suspense boundary` hatası alınır.

   ```tsx
   function PageInner() { const sp = useSearchParams(); /* ... */ }
   export default function Page() {
     return (<Suspense fallback={null}><PageInner /></Suspense>);
   }
   ```

3. **`.npmrc`** — Repo kökündeki `.npmrc` içindeki `legacy-peer-deps=true`
   satırı, peer-dependency çakışmaları nedeniyle gereklidir. **Silmeyin.**

## 3. Cron kısıtı (Vercel Hobby planı)

`vercel.json`'daki cron'lar **günde en fazla 1 kez** çalışabilir. `0 */6 * * *`
(6 saatte bir) gibi sık zamanlamalar deploy'u `deploy_failed` ile başarısız
kılar. Mevcut ayar günlüktür:

- `sync-calls`: `0 3 * * *` (her gün 03:00)
- `sync-fireflies`: `0 4 * * *` (her gün 04:00)

Daha sık senkron gerekiyorsa Vercel **Pro** planına geçilmelidir.

## 4. Ortam değişkenleri

Yerel geliştirme ve scriptler için bağlantı bilgileri **`.env.local`**
dosyasındadır (`.env` değil). Bir script `dotenv` ile env yüklerken
`.env.local`'i hedeflediğinden emin olun:

```ts
import { config } from "dotenv";
config({ path: ".env.local" });
```

## 5. Dağıtım (deploy)

- `main`'e merge edilince Vercel **otomatik** production deploy yapar →
  https://qa-project-by-kagan.vercel.app
- **CI (GitHub Actions)** her PR'da `next build` + testleri çalıştırır.
  Kontrol **yeşil olmadan merge etmeyin** — kırmızı bir build, bozuk kodun
  canlıya gitmesi demektir.
