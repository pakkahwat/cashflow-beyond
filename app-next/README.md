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

## Step 3 — Create a Cloudflare Tunnel

1. [Cloudflare Zero Trust](https://one.dash.cloudflare.com) > **Networks > Tunnels > Create a tunnel**.
2. Name it (e.g. `cashflow-beyond`), copy the **tunnel token**.
3. In **Public Hostname** add a route:
   - Subdomain / domain: your public hostname
   - Service: `http://cashflow-app:8080`

---

## Step 4 — Configure and run

```bash
cd app-next
cp .env.example .env
# Edit .env — fill in all values (Firebase config, cashflow_app password, TUNNEL_TOKEN)
```

Then from the **repo root**:

```bash
docker compose up --build
```

Open your tunnel hostname in a browser and play.

---

## Local development

Local dev runs Next dev server + a separate WebSocket server (no Docker needed):

```bash
cd app-next
cp .env.example .env.local    # or edit the existing .env.local
# Fill in Firebase values (MONGO_URL optional for local testing)

# Terminal 1 — Next dev server (port 3000):
npm run dev

# Terminal 2 — WebSocket dev server (port 3001):
npm run dev:ws
```

The dev WebSocket base URL is set in `.env.development` (committed, no secrets):
```
NEXT_PUBLIC_WS_BASE=ws://localhost:3001
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
| `TUNNEL_TOKEN` | Runtime (cloudflared) | Cloudflare tunnel token |
| `PORT` | Runtime (server) | HTTP port (default `8080`) |

`NEXT_PUBLIC_*` values are **baked into the browser bundle at build time** — changing them requires a rebuild (`docker compose up --build`).

---

## Notes

- `cashflow-modern/` in the repo root is the prior Phaser-based stack — kept for reference, not used by this Docker setup.
- To update the app: pull, then `docker compose up --build` again.
