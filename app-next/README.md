# Cashflow Beyond — Fill In and Play

A 3D multiplayer Cashflow board game with Google login and persistent stats.
Custom Next.js server (`tsx server.ts`) runs Next + WebSocket on a single port.

---

## Prerequisites

- Docker + Docker Compose v2
- The `shared-db` external Docker network and `shared-mongo` container are running
  (part of the `database-and-storage` stack on the host):
  ```bash
  docker network inspect shared-db   # must exist
  docker ps --filter name=shared-mongo  # must be up
  ```

---

## Step 1 — Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com) > **Add project**.
2. **Authentication > Sign-in method > Google** — enable it.
3. **Authentication > Settings > Authorized domains** — add:
   - `localhost` (already there by default)
   - your tunnel public hostname (e.g. `cashflow.yourdomain.com`)
4. **Project Settings > Your apps > Add app > Web** — register an app, copy the **Config** object.

You will use these values: `apiKey`, `authDomain`, `projectId`, `appId`.

---

## Step 2 — Create the MongoDB user (first-time setup)

Connect to `shared-mongo` (local production DB) and create a dedicated user:

```bash
docker exec -it shared-mongo mongosh -u <admin_user> -p <admin_pass> --authenticationDatabase admin
```

```js
use cashflow
db.createUser({
  user: "cashflow_app",
  pwd: "CHANGE_ME",          // pick a strong password
  roles: [{ role: "readWrite", db: "cashflow" }]
})
```

The `MONGO_URL` form to use in `.env`:
```
mongodb://cashflow_app:<pwd>@shared-mongo:27017/cashflow?authSource=cashflow
```

---

## Step 3 — Cloudflare Tunnel (locally-managed, already set up)

This repo ships a **locally-managed** tunnel — no token. `cloudflared/config.yml` holds the
ingress (`cashflow.jeerawut.com` -> `http://cashflow-app:8080`, plus a `/__/auth/*` proxy to
`easy-palm.firebaseapp.com` so Google sign-in is same-origin on mobile). The secret
`cloudflared/credentials.json` is **gitignored** and already present on this machine.

The tunnel `cashflow-beyond` and its DNS (`cashflow.jeerawut.com`) are already created. To set
one up on a fresh machine:
```bash
cloudflared tunnel create cashflow-beyond
cloudflared tunnel route dns cashflow-beyond <your-hostname>
cp ~/.cloudflared/<uuid>.json cloudflared/credentials.json   # gitignored
# set tunnel id + hostname in cloudflared/config.yml
```

---

## Step 4 — Configure and run

From the **repo root**:

```bash
cp .env.example .env
# .env is pre-filled (MONGO_URL + Firebase from easy-palm). No TUNNEL_TOKEN needed (locally-managed tunnel).
docker compose up --build
```

Open your tunnel hostname in a browser and play.

---

## Local development

Local dev runs Next dev server + a separate WebSocket server (no Docker needed):

From the **repo root**:

```bash
cp app-next/.env.local.example app-next/.env.local   # then fill in your Firebase web config
# (MONGO_URL is optional for local testing; .env.development already sets NEXT_PUBLIC_WS_URL=ws://localhost:3001)

# Terminal 1 — Next dev server (port 3000):
cd app-next && npm run dev

# Terminal 2 — WebSocket dev server (port 3001):
cd app-next && npm run dev:ws
```

The dev WebSocket base URL is set in `.env.development` (committed, no secrets):
```
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Environment variables reference

| Variable | When used | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Build + runtime | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Build + runtime | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Build + runtime | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Build + runtime | Firebase web config |
| `FIREBASE_PROJECT_ID` | Runtime (server) | Server-side token verification |
| `MONGO_URL` | Runtime (server) | MongoDB connection string |
| _(tunnel)_ | cloudflared | Locally-managed via `cloudflared/config.yml` + `credentials.json` (no token) |
| `PORT` | Runtime (server) | HTTP port (default `8080`) |

`NEXT_PUBLIC_*` values are **baked into the browser bundle at build time** — changing them requires a rebuild (`docker compose up --build`).

---

## Notes

- `cashflow-modern/` in the repo root is the prior Phaser-based stack — kept for reference, not used by this Docker setup.
- To update the app: pull, then `docker compose up --build` again.
