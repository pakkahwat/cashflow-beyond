# Cashflow — เกมการเงิน (ฉบับเขียนใหม่)

เกมกระดาน **Cashflow 101** ของ Robert Kiyosaki แบบครบทั้งสองเฟส — **Rat Race (วงจรหนูถีบจักร)** และ **Fast Track (เส้นทางด่วน)** — เล่นหลายคนแบบเรียลไทม์ รองรับ **ภาษาไทย/อังกฤษ สลับได้**

> เขียนใหม่บน stack สมัยใหม่ และ deploy ได้ทั้งหมดบน **Cloudflare** (Workers + Durable Objects + Pages-style static assets)

## Stack
- **Client**: React 18 + TypeScript + Vite + zustand + react-i18next
- **Realtime backend**: **Cloudflare Worker** + **Durable Objects** + native **WebSocket** (หนึ่งห้องเกม = หนึ่ง Durable Object instance ถือ game state — authoritative)
- **Static hosting**: Worker เสิร์ฟไฟล์ client ที่ build แล้ว (`[assets]`) ทำให้ทั้งเกมอยู่บน origin เดียว ไม่ต้องตั้ง CORS ตอน production

## โครงสร้าง
```
cashflow-modern/
├─ worker/    # Cloudflare Worker (entry) + Durable Object GameRoom  ← backend จริงที่ deploy
│  └─ src/index.ts      routing: /api/board, /api/room, /ws → DO, ที่เหลือ → static assets
│  └─ src/GameRoom.ts   Durable Object: ถือ Game + จัดการ WebSocket + broadcast state
│  └─ wrangler.toml     binding ของ Durable Object + assets
├─ client/   # React UI (กระดาน, การ์ด, งบการเงิน, i18n)
└─ server/   # game engine (Game/Player/RatRace/FastTrack/decks) — โค้ด TS ที่ worker นำไป bundle ใช้ซ้ำ
             # (ไฟล์ index.ts ที่เป็น Express+Socket.IO เดิม เก็บไว้เป็น reference เฉยๆ)
```
หัวใจของเกมคือ `server/src/engine/*` ซึ่งเป็น TypeScript ล้วน ไม่ผูกกับ Node/Express — Durable Object จึง `import` มาใช้ได้ตรงๆ

## รันในเครื่อง (dev)

ต้องมี **Node 18+** (แนะนำ 20 LTS)

```bash
cd cashflow-modern
npm install            # ติดตั้ง concurrently
npm run install:all    # ติดตั้ง deps ของ client + worker
npm run dev            # รัน wrangler (worker, :8787) + vite (client, :5173) พร้อมกัน
```
- เปิด <http://localhost:5173> (client มี HMR, คุยกับ worker ที่ :8787 ผ่าน `VITE_SERVER_URL`)
- Durable Objects ถูกจำลองในเครื่องด้วย **Miniflare** — ไม่ต้องล็อกอิน Cloudflare

### ทดสอบแบบ production จริง (Worker เสิร์ฟ client เอง)
```bash
npm run preview        # build client แล้วให้ worker เสิร์ฟทุกอย่างที่ http://localhost:8787
```

## Deploy ขึ้น Cloudflare

ครั้งแรกต้องล็อกอิน (เปิดเบราว์เซอร์ให้ยืนยัน):
```bash
npx --prefix worker wrangler login
```
จากนั้น:
```bash
npm run deploy         # build client + wrangler deploy (อัป Worker + Durable Object + static assets)
```
Wrangler จะให้ URL เช่น `https://cashflow-modern.<subdomain>.workers.dev` — เปิดเล่นได้เลย แชร์รหัสห้องให้เพื่อน

> Durable Objects ใช้ได้บน Workers free plan (เป็นแบบ SQLite-backed ตาม `wrangler.toml`)

## กฎเกมโดยย่อ
1. **Rat Race**: ทอยเต๋าเดินรอบกระดาน — รับเงินเดือน (Payday), ลงทุนอสังหา/ธุรกิจ/หุ้น/ทอง, เจอรายจ่าย (Doodad), การกุศล, ตกงาน, มีลูก
   - **หนีออกได้เมื่อ**: รายได้ไม่ต้องทำงาน (Passive Income) > รายจ่ายรวม
2. **Fast Track**: ได้เงินก้อน (= passive income × 100) แล้วเล่นวงนอก
   - **ชนะเมื่อ**: ซื้อ "ความฝัน" ของตัวเองสำเร็จ **หรือ** เพิ่มกระแสเงินสด +$50,000/เดือน
```
