# KARUNA backend

FastAPI + SQLAlchemy (Postgres or SQLite) + JWT auth + WebSocket broadcast +
optional Claude vision proxy. Designed to deploy to Render's free tier
without any code changes.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate              # Windows:  .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                   # then edit .env to set JWT_SECRET
python3 -m uvicorn backend.main:app --reload --port 8000
```

Hit `http://localhost:8000/api/health` — you should get
`{"ok": true, "claudeEnabled": false}`. The default uses SQLite at
`./karuna.db`; the file is auto-created.

## Point the frontend at it

In the Karuna app folder:

```bash
echo "VITE_API_URL=http://localhost:8000" >> .env
npm run dev
```

That's the entire switch. The app boots in remote mode, fetches cases
over REST, and subscribes to `ws://localhost:8000/ws` for live updates.
Open the app in two browser windows and submit a case in one — it
appears in the other within ~1 second, no refresh needed.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register a user (role: citizen / ngo / vet / admin) |
| POST | `/api/auth/login` | — | Returns `{access_token, user}` |
| GET | `/api/auth/me` | bearer | Current user |
| GET | `/api/cases` | — | All cases |
| POST | `/api/cases` | optional | Create a case (reporter can be anonymous) |
| GET | `/api/cases/{id}` | — | One case |
| PATCH | `/api/cases/{id}/assign` | ngo / admin | Dispatch a responder |
| PATCH | `/api/cases/{id}/status` | ngo / vet / admin | Move case through pipeline |
| POST | `/api/cases/{id}/notes` | ngo / vet / admin | Add a note |
| POST | `/api/cases/{id}/donations` | — | Add a donation |
| POST | `/api/cases/{id}/adoption-apply` | — | Apply to adopt |
| PATCH | `/api/cases/{id}/adoption/{appId}` | ngo / admin | Approve / reject |
| POST | `/api/ai/triage` | — | Claude proxy (mock fallback) |
| WS | `/ws` | — | Broadcasts every mutation as a JSON event |

WebSocket event shape:

```json
{ "type": "case.created" | "case.assigned" | "case.status" | "case.donation" | …,
  "caseId": "case_…",
  "payload": { /* the updated Case object */ } }
```

## Deploy to Render (free tier)

1. **Push the repo to GitHub.** Render only deploys from a Git remote.
2. In Render → **New +** → **Web Service** → connect the repo.
3. Settings:
   - **Root directory**: `backend`
   - **Runtime**: Python 3.11
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
4. **Environment variables** (Render dashboard → Environment):
   - `JWT_SECRET` — `python -c "import secrets; print(secrets.token_urlsafe(48))"`
   - `ALLOWED_ORIGINS` — your Vercel/Netlify URL (e.g. `https://karuna.vercel.app`)
   - `ANTHROPIC_API_KEY` — optional, enables live Claude triage
   - `DATABASE_URL` — Render gives you a free Postgres instance; click
     "Add Database" and Render will inject the URL automatically.
5. Click **Create**. First deploy takes ~2 min. You'll get a URL like
   `https://karuna-api.onrender.com`.
6. In the frontend, set `VITE_API_URL=https://karuna-api.onrender.com`
   and redeploy your Vercel/Netlify site.

### One-click via `render.yaml`

A `render.yaml` is included — if you push it to GitHub, Render's
"Blueprint" deploy detects it and provisions the web service + Postgres
in one click.

## Database

- **Local**: SQLite at `./karuna.db`, auto-created on first run.
- **Render**: Postgres URL injected by Render; tables auto-created on
  startup (`init_db()` calls `Base.metadata.create_all`).
- For schema migrations later, add Alembic; we deliberately skipped it
  for the demo.

## Security notes (read before going public)

- Image data URLs are stored as `TEXT`. Fine for the demo; in production
  upload images to S3/GCS and store only the URL.
- No rate limiting — add `slowapi` if exposing publicly.
- CORS allows the origins listed in `ALLOWED_ORIGINS` only. Don't use `*`.
- `JWT_SECRET` must be 32+ random chars in production. Change before
  any real deployment.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `email-validator is not installed` | `pip install email-validator` (already in requirements.txt) |
| `Connection refused` on `:8000` | Server didn't start — check `uvicorn` logs |
| 401 on `/api/cases/{id}/assign` | NGO/admin role required; log in as one |
| WebSocket disconnects every ~30s | Render free tier spins down idle services. Send a periodic HTTP ping or upgrade the dyno. |
| Frontend ignores `VITE_API_URL` | Vite only reads `.env` on dev-server start — restart `npm run dev` |
