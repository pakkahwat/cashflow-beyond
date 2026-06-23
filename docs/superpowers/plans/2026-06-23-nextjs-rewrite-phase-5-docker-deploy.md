# Cashflow Beyond v2 — Phase 5: Docker + cloudflared + "fill-in-and-play" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Package the app so the user only fills in a `.env` (Firebase web config, `FIREBASE_PROJECT_ID`, `MONGO_URL`, cloudflared tunnel token) and runs `docker compose up --build` to get a public, playable game — fulfilling "กรอกข้อมูลแล้วเล่นได้เลย".

**Architecture:** A multi-stage Docker image builds the Next app and runs the custom server (`tsx server.ts` = Next `dev:false` + ws on `:8080`). `docker-compose.yml` runs `cashflow-app` plus a `cloudflared` sidecar (matching the repo's existing tunnel pattern), joined to the external `shared-db` network so the app reaches `shared-mongo:27017`. Because `NEXT_PUBLIC_*` are inlined at **build time**, the Firebase web config is passed as Docker **build args**. A consolidated `.env.example` + README enumerate every fill-in.

**Tech Stack:** Docker (multi-stage), docker-compose, cloudflare/cloudflared, Node 22 (≥22.13 for Next 16).

**Spec:** §8. **Prior:** Phases 1–4 complete (playable + auth + Mongo stats). Custom server `app-next/server.ts` serves Next+ws on `PORT` (default 8080).

## Global Constraints
- Branch `feat/nextjs-rewrite`; never `main`; work from repo root.
- Node image ≥ 22.13 (Next 16 requirement). App listens on `PORT` (default 8080), single origin (ws same-origin in prod).
- `NEXT_PUBLIC_FIREBASE_*` are **build-time** → Dockerfile `ARG`+`ENV` and compose `build.args`. Server-only secrets (`MONGO_URL`, `FIREBASE_PROJECT_ID`, `TUNNEL_TOKEN`) are **runtime** env.
- Join the **external** Docker network `shared-db` (already exists) to reach `shared-mongo`. Match the existing cloudflared sidecar pattern (`files-thing-tunnel`, `codepush-broker-tunnel`).
- **Do NOT delete `cashflow-modern/`** in this phase (preserve the user's prior work / reference). Note it as an optional later cutover. Don't commit real secrets — `.env.example` holds placeholders only.

## File Structure
- `app-next/Dockerfile` — NEW, multi-stage (deps+build → runtime running `tsx server.ts`).
- `app-next/.dockerignore` — NEW (`node_modules`, `.next`, `.env*`, `e2e`, test files).
- `docker-compose.yml` — NEW at repo root (or `app-next/`): `cashflow-app` + `cloudflared`, networks `shared-db` (external) + internal.
- `app-next/.env.example` — NEW, consolidated fill-ins (placeholders).
- `app-next/README.md` — REPLACE the stock boilerplate with the "fill in and play" runbook.

---

### Task 1: Dockerfile + .dockerignore (image builds and serves)

- [ ] **Step 1: `.dockerignore`** — `node_modules`, `.next`, `.env`, `.env.*`, `e2e`, `**/*.test.ts`, `.git`.
- [ ] **Step 2: Multi-stage `Dockerfile`** (`app-next/Dockerfile`):
```dockerfile
# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* must exist at build time (Next inlines them):
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
RUN npm run build
# ---- runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app ./
EXPOSE 8080
CMD ["npx", "tsx", "server.ts"]
```
(The custom server runs the TS `server.ts` via `tsx` against the built `.next`; the runtime stage keeps the full app + `node_modules` so `tsx` can run server.ts and its imports. If image size matters later, switch to Next standalone output — out of scope now.)
- [ ] **Step 3: Build + boot verify (no tunnel, no real secrets).**
```bash
cd app-next && docker build -t cashflow-beyond:test \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY=demo \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo .
docker run -d --name cf-test -p 8099:8080 -e FIREBASE_PROJECT_ID=demo cashflow-beyond:test
sleep 8 && curl -sS -o /dev/null -w "home=%{http_code}\n" http://localhost:8099/
docker rm -f cf-test
```
Expected: image builds; `home=200`. (Mongo/tunnel not required for this boot check; the app serves the login gate.) Report the build output tail. Commit (`feat: Dockerfile + .dockerignore for the Next custom server`).

---

### Task 2: docker-compose + .env.example + README runbook

- [ ] **Step 1: `docker-compose.yml`** (repo root):
```yaml
services:
  cashflow-app:
    build:
      context: ./app-next
      args:
        NEXT_PUBLIC_FIREBASE_API_KEY: ${NEXT_PUBLIC_FIREBASE_API_KEY}
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
        NEXT_PUBLIC_FIREBASE_APP_ID: ${NEXT_PUBLIC_FIREBASE_APP_ID}
    environment:
      PORT: 8080
      FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}
      MONGO_URL: ${MONGO_URL}
    networks: [shared-db, internal]
    restart: unless-stopped
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run
    environment:
      TUNNEL_TOKEN: ${TUNNEL_TOKEN}
    depends_on: [cashflow-app]
    networks: [internal]
    restart: unless-stopped
networks:
  shared-db:
    external: true
  internal: {}
```
(The cloudflared tunnel's public hostname routes to `cashflow-app:8080` — configured in the Cloudflare dashboard tunnel ingress, or a `config.yml`; documented in the README.)
- [ ] **Step 2: `app-next/.env.example`** (placeholders only):
```
# ===== Cashflow Beyond — fill these in, then `docker compose up --build` =====
# 1) Firebase (Authentication only) — from your Firebase project > Web App config.
#    Also enable the Google sign-in provider and add your tunnel hostname + localhost
#    to Firebase Auth > Settings > Authorized domains.
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=

# 2) MongoDB (production = local shared-mongo via the shared-db network).
#    Use the dedicated cashflow_app user created during setup:
MONGO_URL=mongodb://cashflow_app:CHANGE_ME@shared-mongo:27017/cashflow?authSource=cashflow
# TEST db (do not use for prod): mongodb://...@203.113.14.27:27017/cashflow?authSource=cashflow

# 3) cloudflared tunnel token (Cloudflare Zero Trust > Tunnels), route hostname -> cashflow-app:8080
TUNNEL_TOKEN=
```
- [ ] **Step 3: README runbook** — replace `app-next/README.md` with concise steps: prerequisites (Docker, the `shared-db` network + `shared-mongo` running); create Firebase project, enable Google provider, add authorized domains, copy web config; create the `cashflow_app` Mongo user (command provided); create a cloudflared tunnel + token + ingress to `cashflow-app:8080`; copy `.env.example`→`.env`, fill in; `docker compose up --build`; open the tunnel hostname and play. Also document local dev (`npm run dev` + `npm run dev:ws`, `.env.development`).
- [ ] **Step 4: Validate compose config** — `docker compose config` (with a dummy `.env`) parses without error; `docker compose build cashflow-app` succeeds with build args. Report output. Commit (`feat: docker-compose + cloudflared + .env.example + fill-in-and-play README`).

---

## Self-Review
**1. Spec coverage (§8):** multi-stage Dockerfile running the custom server; compose with `cashflow-app` + `cloudflared` on external `shared-db`; consolidated `.env.example` of every fill-in; README runbook. The `NEXT_PUBLIC_*` build-time gotcha is handled via build args. Old-stack removal intentionally deferred (don't delete the user's prior work).
**2. Placeholder scan:** Dockerfile, compose, and `.env.example` are concrete; the README content is enumerated (steps listed) and the tunnel ingress is a dashboard step (documented, not code). No secrets committed (placeholders only).
**3. Consistency:** `PORT 8080` / `tsx server.ts` match Phase-2a's server. `MONGO_URL`/`cashflow_app`/db `cashflow` match Phase 4. `NEXT_PUBLIC_FIREBASE_*` + `FIREBASE_PROJECT_ID` match Phase 3. `shared-db` external network matches the verified Docker setup.

## Done = goal met
After Phase 5: the user fills `app-next/.env` (Firebase config, `FIREBASE_PROJECT_ID`, `MONGO_URL` with the created `cashflow_app` password, `TUNNEL_TOKEN`), runs `docker compose up --build`, and plays the 3D Cashflow game at their tunnel hostname with Google login and persisted stats — "กรอกข้อมูลแล้วเล่นได้เลย".
```
```
