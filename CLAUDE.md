# CLAUDE.md — Cennet Bahçeleri Web / Admin Paneli

## Genel çalışma kuralları

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. **Think Before Coding** — State assumptions explicitly. If multiple interpretations exist, present them; don't pick silently. If something is unclear, stop and ask. If a simpler approach exists, say so.
2. **Simplicity First** — Minimum code that solves the problem. No features, abstractions, configurability or error handling that wasn't asked for. If 200 lines could be 50, rewrite it.
3. **Surgical Changes** — Touch only what you must. Don't "improve" adjacent code, comments or formatting. Match existing style. Mention unrelated dead code, don't delete it. Remove only the orphans YOUR change created. Every changed line should trace to the user's request.
4. **Goal-Driven Execution** — Define a verifiable success criterion before starting and loop until it is met. For multi-step tasks state a brief plan: `[Step] → verify: [check]`.

## Kullanıcı tercihleri

- Türkçe, doğrudan, sade anlatım. Uzun teori yerine somut ilerleme.
- Onaylanmış dar kapsamlı işte rutin adımlar için tekrar onay isteme. Kapsam değişirse sor.
- Gereksiz refactor, yeniden adlandırma, bağımlılık yükseltmesi yok. Çalışan davranış korunur.
- Kullanıcı PowerShell kullanıyor ve birden fazla bilgisayarda çalışıyor; taşıma Git üzerinden.
- Yapılmayan testi yapılmış gibi gösterme. Görsel/arayüz işlerinde tarayıcıda gerçek sonuç esastır. Rapor ile diff çelişirse diff esastır.

## Git kuralları

- `git add` her zaman **açık dosya listesiyle**. Asla `git add .`, `git clean`, `git reset --hard`, toplu `restore`.
- Untracked dosyalar (`admin_main.js`, `data/`, `scripts/`, `.hadith_migration_stage/`, `*.traineddata`, `node_modules/`, checkpoint/diff dosyaları, `supabase/*.sql` taslakları) ilişkisiz çalışmalardır. Silme, commit'e alma.
- `.env`, Telegram bot token'ı, Google API anahtarları ve service_role anahtarı asla commit'lenmez, çıktıya yazılmaz.

## Proje özeti

Sade HTML/CSS/JavaScript (framework ve build adımı yok), Netlify'da barındırılıyor. Android uygulamasıyla **aynı Supabase projesini** kullanır (`config.js`: URL, publishable anon key, `suggestions` tablosu, `suggestion-photos` bucket).

- `index.html` + `script.js` + `styles.css` + `notify.js`: herkese açık program önerisi formu.
- `admin.html` + `admin.js` (~15 bin satır) + `admin.css`: yönetici paneli. `admin.html` yalnız `admin.js`'i yükler; untracked `admin_main.js` kullanılmıyor, dokunma.
- `assets/locations.js`: il/ilçe verisi.
- `netlify/functions/`: `notify.js` (Telegram bildirimi), `overpass-proxy.js` (OpenStreetMap Overpass vekili). `supabase/functions/google-places-proxy`: Supabase Edge Function.
- `supabase/*.sql`, kökteki `migration_*.sql`: migration dosyaları. Canlıya uygulanmış sayılmaz.
- `privacy.html`: gizlilik politikası sayfası.

### Admin panel bölümleri

Bekleyen öneriler · Programlar · Kurum/Cemaat/Oluşum · Cami konumları · Keşfet içerikleri · Türbe ve makamlar · Müftülük vaaz programları · Zikir halkaları · Tüm programlar Instagram & teyit.

## Güvenlik ve veri kuralları

- Panel tarayıcıda çalışır; yetki Supabase Auth + RLS + sunucuda `is_admin` ile sağlanır. Sayfaya service_role anahtarı gömülmez.
- Canlı Supabase şemasına veya verisine kullanıcı açıkça istemeden yazma. Migration'ları önce salt okunur kontrol et.
- Öneri onaylama/programa aktarma davranışı Android admin ekranının referansıdır. Değiştirirken Android tarafını da düşün (bkz. Android reposundaki `docs/devir-teslim-chatgpt.md`, atomik onay RPC kararı).
- Programı kaldırma = `active/inactive`, kalıcı silme yok.
- Tarih, saat, hoca, kurum, mekân ve dinî metinler tasarım uğruna değiştirilmez.
- **Yayın:** Netlify'a GitHub üzerinden otomatik yayın olup olmadığı DOĞRULANMADI. `main`'e push canlıya çıkabilir; doğrulanana kadar `main`'e kullanıcı onayı olmadan push etme, işleri dalda yap.

## İlgili proje

Android uygulaması: `C:\Users\Administrator\AndroidStudioProjects\cennet-bahceleri-android` (GitHub `mutoadam/cennet-bahceleri-android`). Supabase tablo/RPC değişiklikleri iki projeyi birlikte etkiler.
