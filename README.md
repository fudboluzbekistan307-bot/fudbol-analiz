# ⚽ Fudbol Analiz

Futbol o'yinlarini chuqur tahlil qiluvchi platforma: **web sayt + Telegram bot + live**.

- Tahlil o'yindan **72 soat (3 kun) oldin** ochiladi va bosqichma-bosqich yangilanadi:
  - **72 soat** — dastlabki tahlil
  - **24 soat** — asosiy tahlil
  - **3 soat** — yakuniy tahlil (shubhali o'yinchilar aniqlanadi, tarkiblar 1 soatda tasdiqlanadi)
- Hisobga olinadigan omillar: reyting, uy maydoni, forma (oxirgilari og'irroq), xG formasi, jarohatlar va
  diskvalifikatsiyalar (o'yinchi ahamiyati va pozitsiyasi bo'yicha), dam olish kunlari/charchoq, ob-havo
  (yomg'ir, shamol, issiq/sovuq, prognoz ishonchliligi), turnir jadvali va motivatsiya, shaxsiy uchrashuvlar,
  shahar derbisi, hakam statistikasi, maydon qoplamasi.
- Natija: 1X2 ehtimollari, kutilayotgan gollar (xG), 1.5/2.5/3.5 ko'p-kam, ikkala jamoa gol uradimi,
  eng ehtimolli hisoblar, kutilayotgan sariq kartochkalar, ishonch darajasi va o'zbekcha xulosa.
  Model: Puasson taqsimoti + Dixon–Coles tuzatmasi.
- **Live**: hisob, daqiqa, hodisalar, statistika va o'yin davomida qayta hisoblanadigan ehtimollar (SSE orqali real vaqtda).
- **Telegram bot**: o'yinlar ro'yxati, tahlil, barcha omillar, live holat va obuna bo'lingan o'yinlar bo'yicha
  gol / qizil kartochka / tanaffus / yakun xabarnomalari.

> Hozircha **mock ma'lumotlar** bilan ishlaydi (deterministik — bir xil o'yin har safar bir xil ma'lumot beradi).
> Demo uchun har 2 soatda bitta "live" o'yin avtomatik yaratiladi. Haqiqiy API keyinroq ulanadi.

## Tuzilma

```
apps/
  api/        Express server: REST + SSE + bot webhook + production'da web'ni beradi
  web/        React + Vite sayt (Telegram Mini App sifatida ham ochiladi)
packages/
  core/       Tahlil dvigateli, mock provider, live simulyator, servis (bog'liqliksiz, testlar bilan)
  bot/        Grammy Telegram bot
```

## Ishga tushirish (lokal)

```bash
pnpm install
cp .env.example .env      # kerak bo'lsa BOT_TOKEN va DATABASE_URL ni kiriting
pnpm dev                  # API :3000 + web :5173
pnpm test                 # core testlari
```

- `DATABASE_URL` bo'sh bo'lsa — ma'lumotlar xotirada saqlanadi (dev uchun yetarli).
- `BOT_TOKEN` bo'lsa va `PUBLIC_URL` bo'sh bo'lsa — bot **polling** rejimida ishlaydi.

## API

| Yo'l | Tavsif |
|---|---|
| `GET /api/health` | Holat |
| `GET /api/leagues` | Ligalar |
| `GET /api/matches?from=ISO&to=ISO&league=epl&status=live` | O'yinlar (oraliq ≤ 14 kun) |
| `GET /api/matches/:id` | O'yin |
| `GET /api/matches/:id/analysis` | To'liq tahlil (72 soatdan uzoq bo'lsa `available: false`) |
| `GET /api/matches/:id/timeline` | Tahlil dinamikasi (72/48/24/6/1 soat) + saqlangan snapshotlar |
| `GET /api/live` | Hozirgi live o'yinlar |
| `GET /api/matches/:id/live` | Live holat |
| `GET /api/live/stream`, `GET /api/matches/:id/live/stream` | SSE oqimlari |

## Render'ga deploy

1. Render → **New → Blueprint** → shu repo. `render.yaml` web servis va PostgreSQL yaratadi.
2. `BOT_TOKEN` ni panelda kiriting. `PUBLIC_URL` kerak emas — Render `RENDER_EXTERNAL_URL` ni o'zi beradi,
   bot avtomatik **webhook** rejimiga o'tadi.
3. Lokal `pnpm install` dan keyin `pnpm-lock.yaml` ni commit qilish tavsiya etiladi.

Free tier eslatmalari: servis 15 daqiqa faolsizlikdan keyin uxlaydi (Telegram webhook uni uyg'otadi, lekin
uxlab turganda live xabarnomalar yuborilmaydi); bepul PostgreSQL muddati cheklangan.

## Haqiqiy API ulash

`packages/core/src/mockProvider.js` dagi interfeysni amalga oshiruvchi yangi provider yozing
(`listMatches`, `getMatch`, `getContext`) va `packages/core/src/index.js` dagi `createProvider` ga qo'shing,
so'ng `DATA_PROVIDER` ni o'zgartiring. Tahlil dvigateli, bot va sayt o'zgarmaydi.
Live uchun esa provider'dan real hodisalarni olib, `inPlayProbabilities` bilan ehtimollarni hisoblash kifoya.
