# AG Associates — Production Deployment Playbook

**Target architecture:** one Linux VPS, Docker Compose, Caddy reverse proxy with auto-TLS, Supabase Cloud for Auth, Groq/Gemini for LLM.

Optimized for: lowest cost, fastest path to "live", full orchestration (CI deploys, automated backups). RTO ≈ 1 hour from a restic snapshot.

> **Why not Cloud Run / Vercel?** That managed-cloud path is documented in the appendix at the end of this file. Use it once bank traffic justifies the cost.

---

## 1. One-time provisioning

### 1.1 Pick a VPS

Hetzner CCX23 or equivalent (4 vCPU, 16 GB RAM, NVMe, ~€30/mo) running **Ubuntu 24.04 LTS**. Single region: choose one near your users — `fsn1` (Frankfurt) or `hel1` (Helsinki) for the EU; AWS Mumbai (`ap-south-1`) class machine if you need India proximity.

### 1.2 Domain + DNS

Register a domain (Cloudflare Registrar, Porkbun, etc.). Create five **A records** pointing to the VPS IPv4:

| Subdomain | Service |
|---|---|
| `app.<domain>` | ag-platform (LegalTech UI) |
| `dashboard.<domain>` | AI workflow dashboard |
| `api.<domain>` | FastAPI agents |
| `n8n.<domain>` | n8n orchestrator |
| `docs.<domain>` | Static docs site |

If you front Cloudflare, set proxy to **DNS-only (gray cloud)** for the initial Let's Encrypt handshake — switch to proxied after the first cert issues.

### 1.3 Supabase Cloud project

1. Create a free-tier project at [supabase.com](https://supabase.com). Region: `ap-south-1` (Mumbai) for Indian banking compliance, or your nearest region otherwise.
2. **SQL Editor** → run `ag-platform/src/server/migrations.sql` (cases, profiles, timesheets, organizations tables).
3. **Database → Extensions** → enable `pgvector` (not strictly required for Supabase since the on-VPS Postgres handles embeddings, but useful if you later migrate).
4. **Authentication → Providers** → enable Email (magic links). Add `https://app.<domain>` to the allowed redirect URLs.
5. Copy **Project URL**, **anon key**, **service_role key**, and **JWT Secret** (Settings → API). These go into `/srv/ag/.env` on the VPS.

### 1.4 LLM provider

Default: **Groq free tier** (`llama-3.1-70b-versatile`, OpenAI-compatible). Sign up at [console.groq.com](https://console.groq.com), create an API key. Or use Gemini via the OpenAI-compatible endpoint — set `LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai` and provide your Gemini key.

### 1.5 Bootstrap the VPS

SSH in as root, then:

```bash
curl -fsSL https://raw.githubusercontent.com/LUXORANOVA9/AGASSOCIATES/main/scripts/bootstrap-vps.sh | bash
```

This installs Docker, hardens the firewall (ufw + fail2ban), creates a `deploy` user, clones the repo to `/srv/ag/repo`, and seeds `/srv/ag/.env` from the template. Read the on-screen "Next steps" the script prints when it finishes.

### 1.6 Fill in secrets

Edit `/srv/ag/.env` (mode 0600, owner `deploy`) and replace every `REPLACE_WITH_*` value. Generate strong secrets with `openssl rand -hex 32`. Generate the n8n basic-auth password hash with:

```bash
docker run --rm caddy:2 caddy hash-password --plaintext 'your-n8n-password'
```

### 1.7 First boot

As the `deploy` user:

```bash
cd /srv/ag
docker compose --env-file .env up -d --build
docker compose logs -f
```

Caddy will request Let's Encrypt certs for all five hostnames. First boot takes ~3 minutes (Sentence-Transformer model download is baked into the image so /api/generate-agreement is fast on first hit).

### 1.8 Seed RAG templates

```bash
docker compose exec ai-backend python generate_embeddings.py
```

This populates the `vector(384)` column in the `legal_templates` table for the three seeded Maharashtra rent agreement templates.

---

## 2. Smoke tests

Run from your laptop. All must pass before declaring launch:

```bash
DOMAIN=agassociates.example.com

dig +short app.$DOMAIN dashboard.$DOMAIN api.$DOMAIN n8n.$DOMAIN docs.$DOMAIN
# → all five must resolve to the VPS IP

curl -sf https://api.$DOMAIN/health
# → {"status":"ok"}

curl -sf -o /dev/null -w "%{http_code}\n" https://dashboard.$DOMAIN
# → 200

curl -sfu admin:$N8N_PASS https://n8n.$DOMAIN/ -o /dev/null -w "%{http_code}\n"
# → 200

curl -sf https://docs.$DOMAIN/quickstart -o /dev/null -w "%{http_code}\n"
# → 200

# End-to-end agent run:
curl -sf -X POST https://api.$DOMAIN/api/generate-agreement \
  -H 'Content-Type: application/json' \
  -d '{"raw_input":"Rental agreement between Ramesh and Suresh for ₹15000/month at 12 MG Road, Thane."}'
# → JSON with success:true and a PDF path
```

In the browser, open `https://app.$DOMAIN`, sign in via magic link, create a case scoped to `bank=ICICI`. Sign out, sign in as a user from a different bank; confirm the ICICI case is NOT visible (RLS check).

---

## 3. Continuous deployment

`.github/workflows/deploy.yml` runs on every push to `main` that touches code:

1. Builds three images: `ag-ai-backend`, `ag-ai-dashboard`, `ag-platform`. Pushes to `ghcr.io/luxoranova9/<name>:latest` and `:<sha>`.
2. SSHes into the VPS as `deploy`, pulls the new images, `docker compose up -d --remove-orphans`.
3. Smoke-tests `https://api.<domain>/health` — fails the workflow if non-200.

Required **repo secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS public IP or hostname |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Private half of the SSH key you pasted into `/home/deploy/.ssh/authorized_keys` |
| `VPS_PORT` | `22` (or your custom port) |
| `PROD_DOMAIN` | e.g. `agassociates.example.com` |

The `clerk-docs` repo has its own `deploy.yml` that builds the static site with Bun and rsyncs `dist/` into `/srv/ag/clerk-docs/dist` on the VPS. Caddy serves it directly — no container rebuild needed.

### Rollback

Pin the previous SHA in `/srv/ag/.env`:

```bash
echo "IMAGE_TAG=<previous-sha>" >> /srv/ag/.env
docker compose --env-file .env pull
docker compose --env-file .env up -d
```

Remove the override once verified.

---

## 4. Backups & restore

Nightly cron (`/etc/cron.d/ag-backup`, installed by `bootstrap-vps.sh`) runs `scripts/backup.sh`:

- `pg_dumpall` of the on-VPS Postgres (legal_templates + n8n DBs)
- `tar.gz` of `n8n_data` and `ag_output` Docker volumes
- All staged into a temp dir, then `restic backup` to Backblaze B2 (or Hetzner Storage Box)
- Retention: 7 daily / 4 weekly / 6 monthly

**Restore drill** — practice this monthly:

```bash
export RESTIC_REPOSITORY=b2:ag-backups:/agassociates RESTIC_PASSWORD=…
restic snapshots
restic restore latest --target ./restore
docker exec -i ag_postgres psql -U "$POSTGRES_USER" -d postgres < ./restore/tmp.*/postgres-*.sql.gz
```

Supabase Cloud has its own automated daily backups (Pro tier) — on free tier, use the dashboard to export `cases` and `profiles` weekly.

---

## 5. Observability (minimum viable)

- **Uptime:** UptimeRobot free tier — one monitor per subdomain, 5-minute interval, alert to email + Slack incoming webhook.
- **Logs:** `docker compose logs -f --tail=200 <service>` for now. Phase 2: add `grafana/loki` + `promtail` containers.
- **Errors:** populate `SENTRY_DSN_BACKEND` and `SENTRY_DSN_PLATFORM` in `.env` to wire up Sentry. Leave blank to disable.

---

## 6. Day-2 operations

| Task | Command |
|---|---|
| Tail backend logs | `docker compose logs -f ai-backend` |
| Restart one service | `docker compose restart ag-platform` |
| Apply DB migrations after schema change | `docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -f /docker-entrypoint-initdb.d/init.sql` |
| Re-seed RAG templates | `docker compose exec ai-backend python generate_embeddings.py` |
| Rotate a secret | edit `/srv/ag/.env`, then `docker compose --env-file .env up -d` |
| See Caddy's certificate state | `docker compose exec caddy ls /data/caddy/certificates` |

---

## 7. NeSL integration (deferred)

The mock `/api/nesl/execute` endpoint returns a stub transaction ID. To wire up real Government NeSL filing:

1. Acquire NeSL API credentials and the corporate DSC.
2. Store the DSC in **Hashicorp Vault** or a separate sealed volume on the VPS — NOT in `.env`.
3. Update `main.py` `/api/nesl/execute` with the official SOAP/JSON payloads.
4. Add a network egress allowlist for the NeSL endpoint.

---

## Appendix A — Alternative: managed cloud (Supabase + Cloud Run + Vercel)

Use this path when you cross ~1k concurrent users or need multi-region HA. Original 72-hour-sprint checklist:

1. **Database & Auth (Supabase):** create production project; run `ag-platform/src/server/migrations.sql`; enable `pgvector`; configure providers.
2. **AI Backend on Google Cloud Run:** `docker build -t gcr.io/$PROJECT_ID/ag-ai-backend ./ag-associates-ai/backend`, push, deploy with the env vars from `.env.production.example` (DATABASE_URL pointing at Supabase, SUPABASE_JWT_SECRET, LLM_BASE_URL, CORS_ALLOWED_ORIGINS).
3. **Frontend on Vercel/Cloudflare Pages:** point at `ag-platform/`, set `VITE_*` env vars; for the AI dashboard point at `ag-associates-ai/frontend/`.
4. **n8n:** deploy as a Cloud Run job or use n8n Cloud; update HTTP Request nodes to `https://<backend-url>/api/...`.
5. **Pre-flight:** JWT bridge test, offline-queue test on the Field App, WhatsApp webhook handshake to n8n.

This is the path documented in earlier revisions of this file; it's preserved here for reference.
