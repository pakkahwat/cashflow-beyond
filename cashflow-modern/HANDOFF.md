# Cashflow (cashflow-beyond) — Handoff

เอกสารส่งต่อสำหรับทีมที่จะทำต่อ สรุปสถาปัตยกรรม, สิ่งที่ทำแล้ว, วิธีรัน, และงานที่เหลือ
(เกม Cashflow 101 ของ Robert Kiyosaki — Rat Race + Fast Track, มัลติเพลเยอร์, ไทย/อังกฤษ)

> **TL;DR:** โปรเจคที่ใช้งานจริงคือ `cashflow-modern/` — TypeScript engine + React/Vite client + Cloudflare Worker (Durable Object). ของที่ repo root (`src/`, `index.js`, `public/`, `views/`) คือ **legacy** (Express, ตายแล้ว — ไม่ต้องแตะ)

---

## 1. รันยังไง

```bash
cd cashflow-modern
npm install            # root (concurrently)
npm run install:all    # client + worker
npm --prefix server install   # engine + Vitest (สำหรับเทสต์)

npm run dev            # worker :8787 (wrangler/miniflare) + client :5173 (vite) — เปิด http://localhost:5173
npm run build          # tsc + vite build -> client/dist (worker เสิร์ฟเป็น ASSETS)
npm run typecheck      # client + worker tsc
npm test               # vitest (เทสต์ engine ฝั่ง server)
npm run deploy         # build + wrangler deploy -> cashflow-beyond.<sub>.workers.dev
```

ต้องใช้ **Node 20+** (Tailwind v4 / build). dev เครื่องนี้ทดสอบบน Node v22

---

## 2. สถาปัตยกรรม

```
React client (Vite SPA, Zustand)         client/src
   │  WebSocket (/ws?room=CODE) + fetch /api/*
   ▼
Cloudflare Worker (worker/src/index.ts)  ──เสิร์ฟ client/dist เป็น ASSETS (single origin)
   │  GAME_ROOM.idFromName(roomCode)
   ▼
GameRoom Durable Object (worker/src/GameRoom.ts)  — 1 ห้อง = 1 DO, เก็บ state ลง SQLite (save & resume)
   │  import
   ▼
Shared TS engine (server/src/engine/*) + data (server/src/data/*)  ← กติกาทั้งหมดอยู่ที่นี่
```

- **Engine เป็น authoritative + transport-agnostic** — กติกาทุกอย่างอยู่ใน `Game.ts`/`Player.ts` คืน `ActionResult {ok,error?}`
- **Worker = backend จริง.** มี Node Socket.IO server (`server/src/index.ts`, `rooms.ts`) ค้างอยู่แต่ **dead code** (client ไม่เรียก) — ลบได้ถ้าต้องการ
- Player ผูกด้วย `playerId` (localStorage `cf_pid`) → refresh แล้ว reclaim ที่นั่งได้; client auto-reconnect WebSocket (backoff)
- Wire format: client→`{reqId,event,payload}`, server ack→`{reqId,ok,error?}`, broadcast→`{event:'state',state}`

### Events (client → GameRoom.onMessage)
`join`(create/join/resume), `leaveRoom`, `startGame`, `rollDice`(diceCount 1-3), `chooseDeal`(small/big), `cardAction`(action+payload — incl. `donate`), `takeLoan`, `payLoan`, `liquidate`, `chooseDream`, **`enterFastTrack`** (ใหม่), `fastTrackAction`(buy/skip), `endTurn`

---

## 3. โครงไฟล์สำคัญ

```
server/src/engine/
  Game.ts         state machine: turn loop, landing, cards, loans, Fast Track exit/win, persistence
  Player.ts       income statement + เงินทุก action (payday/doodad/charity/buy/sell/loan/liquidate/FT)
  board.ts        Rat Race 24 ช่อง, payday-on-pass
  decks.ts        draw piles (reshuffle)
  types.ts        contracts (Card, Profession, PublicGameState, ...)
  *.test.ts       Vitest (17 tests) — เทสต์กติกา/บั๊ก ทุกข้อ
server/src/data/
  cards.json      การ์ดทั้งหมด (อังกฤษ) — ไทยอยู่ที่ client/src/i18n/contentTh.ts
  professions.json, fastTrack.ts (board + DREAMS + GOAL 50000)
worker/src/
  index.ts        routing /ws /api + เสิร์ฟ assets ;  GameRoom.ts  Durable Object
client/src/
  components/Game.tsx        ประกอบจอเกม (3D board + HUD overlay)
  components/three/          3D (R3F): Board3D, RatRaceRing3D, FastTrackRing3D, Tile3D, Token3D,
                             Dice3DGL, Lighting, Effects, TileIcon (lucide)
  components/                CardModal, FastTrackModal, DreamPicker, ProfessionCard, Lobby, Home, ...
  lib/socket.ts              WebSocket transport (+ reconnect)
  lib/sfx.ts                 Web Audio sound effects (สังเคราะห์เอง, ไม่มีไฟล์เสียง)
  lib/boardLayout.ts / boardLayout3d.ts   ตำแหน่งช่อง (2D fallback / 3D ring)
  lib/webgl.ts               ตรวจ WebGL (gate fallback)
  store/gameStore.ts         Zustand (state, render3d/quality, mute, + trigger SFX จาก log)
  i18n/  en.json th.json     UI strings ;  contentTh.ts  คำแปลไทยของการ์ด + ชื่ออาชีพ
  styles/index.css           custom CSS (design tokens เป็น CSS vars)
  styles/tailwind.css        Tailwind v4 (utilities + theme, ไม่มี Preflight)
docs/superpowers/
  specs/2026-06-18-cashflow-3d-board-and-rules-fidelity-design.md   spec หลัก
  plans/2026-06-18-cashflow-rules-fidelity.md , 2026-06-18-cashflow-3d-board.md   แผน implement
```

---

## 4. ฟีเจอร์ที่ทำแล้ว

- **กระดาน 3D** (React Three Fiber): วงแหวน Rat Race 24 ช่อง / Fast Track 32 ช่อง, หมาก 3D เดินตามราง, ลูกเต๋า 3D 6 หน้า, Lightformer studio env, **N8AO** ambient occlusion, **AgX** tone mapping, **SMAA**, clearcoat (ลูกเต๋า/ช่อง active), **Outlines** ทอง (ช่อง+หมากปัจจุบัน), disc สะท้อนแสง, OrbitControls + damping
  - มี **quality toggle (High/Low)** + **WebGL fallback** เป็นกระดาน CSS เดิม (เก็บไว้ไม่ลบ) + เคารพ `prefers-reduced-motion`
- **เสียง (SFX)** สังเคราะห์ด้วย Web Audio ต่อ event (ทอย/จั่ว/payday/deal/market/doodad/downsized/baby/charity/fasttrack/win/buy) + ปุ่ม mute (เก็บ localStorage) — trigger จาก activity log ใน `gameStore.onState`
- **i18n ไทย/อังกฤษ**: UI strings + **เนื้อการ์ดทั้ง 147 ใบ** + ชื่ออาชีพ (สลับด้วยปุ่มภาษา; ไทยเป็น default)
- **Responsive** (breakpoints 960/600/400) + **TailwindCSS v4** integrate แล้ว (ใช้ utility `bg-panel`/`text-gold`/`border-line` ได้)
- **กติกา** ตรวจเทียบ rulebook Cashflow 101 จริง (ดูหัวข้อ 5)

---

## 5. สถานะความตรงกับกติกา Cashflow 101

ตรวจล่าสุด: **33 กฎ → ครบ ~26 / partial / house-rule (ดูด้านล่าง)**. กติกาหลัก (charity→ทอย 1/2 ลูก 3 เทิร์น, payday จ่ายตอนผ่าน, ออกเมื่อ passive **>** รายจ่าย, FT win +$50k หรือซื้อ Dream, bank loan 10%/$1000, ล้มละลายลดหนี้ก่อน, FT loss Divorce=ทั้งหมด/Lawsuit=ครึ่ง) **ตรงและมีเทสต์**

**เพิ่งทำเสร็จ (Phase 3):**
- **M5** — ออก Rat Race เป็น "ตัวเลือกต้นเทิร์น" แล้ว (`getState().awaitingFastTrackChoice` + action `enterFastTrack`) ไม่ auto-บังคับ
- **M4/L8** — เลือก Dream ได้ตั้งแต่ setup (`chooseDream` ไม่ต้องอยู่ FT แล้ว) + ราคาขึ้น 100%/marker เมื่อมีคนเหยียบ Dream เรา (`dreamMarkers`)

**ยังเหลือ (ถ้าจะทำให้ครบ 100%):**
- **M6** — Market ขายได้เฉพาะผู้เล่นปัจจุบัน (ทางการ = ทุกคนที่ถือ asset นั้นขายได้) — ต้องรื้อ decision model ให้รับ action นอกตา (`applicableToEveryOne` ใน types ยังไม่ถูกอ่าน) *(หมายเหตุ: หุ้น split/reverse กระทบทุกคนแล้ว)*
- **L3** — ไม่มีบรรทัด Retail Payment/Debt (ไม่มีการ์ดใช้ → ไม่กระทบ)
- **L7** — FT investment คิด "ราคาเต็ม" ไม่ใช่ "เงินดาวน์" (ยังไม่มี field downPayment ใน fastTrack.ts)
- **house-rules (ตั้งใจ):** ขายคืน asset 50%, ลำดับช่อง 3 payday (ทางการไม่มี diagram)

ดูตารางเต็มได้ใน `docs/superpowers/specs/...-design.md` (§5 fixes, §7 deferred, §8 house-rules)

---

## 6. การทดสอบ

- **Engine:** `npm test` (Vitest, 17 เทสต์) — ครอบกติกา/บั๊กทุกข้อที่แก้ (H1/H2/M1/M3/M5/M7/M8/M9/C1/C2/C3/C6/C7/L1/L2/L5/L6/L10 + M4/L8)
- **Integration/visual:** ทดสอบด้วย Playwright (เกม 2 ผู้เล่นจริง) — ยืนยัน: ไม่มี console error, เสียงเล่นจริง (นับ oscillator), mute แยกเครื่อง, การ์ด/อาชีพเป็นไทย, DreamPicker ตอน setup, 2D/3D toggle + fallback
- **⚠️ caveat:** screenshot โหมด 3D **High** แบบ headless จะค้าง (ฉากเรนเดอร์ทุกเฟรม + N8AO/SMAA หนัก → Playwright รอ "stable" ไม่จบ) — ไม่ใช่บั๊ก; ทดสอบภาพให้สลับ Low หรือเปิดดูในเบราว์เซอร์จริง

---

## 7. ข้อควรรู้ / Caveats

- **Tone mapping:** โหมด High ให้ composer ทำ (AgX); canvas ตั้ง `NoToneMapping` ตอน highFx, ACES ตอน low (กัน double tone-map) — ดู `Board3D.tsx`
- **Tailwind:** ถ้า dev server รันอยู่ก่อนเพิ่ม `postcss.config.js` ต้อง **restart** ให้ Vite อ่าน postcss (Tailwind ถึงทำงาน)
- **Bundle ~1.2MB** (three.js) — เป็น warning เฉยๆ; อยากลดค่อย code-split
- **Dead code:** Node Socket.IO server (`server/src/index.ts`,`rooms.ts`) + legacy root app — ไม่ได้ใช้
- **prod env:** ไม่มี `.env` prod → `VITE_SERVER_URL` undefined → client ใช้ same-origin (`wss://<host>/ws`) ถูกต้องแล้ว
- คำแปลไทยของการ์ดอยู่ `client/src/i18n/contentTh.ts` (gen จาก workflow) — ถ้าแก้ cards.json ต้องอัปเดต key ให้ตรง

---

## 8. งานต่อ (แนะนำลำดับ)
1. M6 (Market กระทบทุกคน) — งานใหญ่สุดที่เหลือ ต้องทำ multiplayer decision นอกตา + UI prompt ผู้เล่นอื่น
2. L7 (เงินดาวน์ FT investment) — เพิ่ม `downPayment` ใน `fastTrack.ts` + แก้ `buyFastTrackInvestment`
3. ลด bundle (lazy-load three / manualChunks)
4. แสดงราคา Dream ที่ escalate ใน `FastTrackModal` (ตอนนี้ buy ใช้ราคา escalate แต่ display โชว์ราคาฐาน)
5. แปล activity log เป็นไทย (ตอนนี้ log เป็น English template ใน Game.ts)
