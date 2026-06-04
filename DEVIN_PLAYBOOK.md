# DEVIN_PLAYBOOK.md

Operational playbook for [**Devin**](https://devin.ai) (Cognition Labs) when working on this repository.
Companion to [`CLAUDE.md`](./CLAUDE.md) — Claude Code reads that one, Devin reads this one. Conventions are intentionally aligned so both agents produce mutually compatible PRs.

---

## 1. First-Session Checklist

Before opening any file, Devin should:

1. **Read `README.md` then this file end-to-end.** Skim `CLAUDE.md` for repo layout and gotchas.
2. **Check active orchestration state** by reading the **`PR Orchestration Dashboard`** issue (label `pr-dashboard`) and `docs/PR_INDEX.md`. The PR Orchestrator workflow auto-labels, auto-merges (risk-tiered), warns on stale PRs, and detects duplicates — Devin's PRs are subject to it.
3. **Snapshot the sandbox** once the standard setup (below) is green. Future Devin sessions should branch from this snapshot rather than reinstalling.
4. **Pull the latest `main`** before branching — Jules-bot, Claude Code, and human contributors all push frequently.

---

## 2. Sandbox Setup (Reproducible)

Devin runs in its own sandbox. Bring it to a known-good state with these steps; expect ~10 minutes the first time.

```bash
# Clone (use the SSH key Devin manages, not user creds)
git clone git@github.com:LUXORANOVA9/AGASSOCIATES.git && cd AGASSOCIATES

# AI pipeline
cd ag-associates-ai
cp .env.example .env                # then fill in LLM_BASE_URL + DATABASE_URL
docker-compose up -d                # pgvector on 5432, n8n on 5678
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python generate_embeddings.py       # one-time, must complete before first agent run

# Platform
cd ../../ag-platform
npm ci                              # NOT npm install — lockfile is source of truth
cp .env.example .env                # fill in SUPABASE_URL, SUPABASE_ANON_KEY, GEMINI_API_KEY
```

**Save a Knowledge entry** titled `agassociates-setup-OK` once the above is green so future sessions skip reinstallation.

---

## 3. Branch & PR Conventions

| Rule | Value |
|------|-------|
| Branch prefix | `feat/`, `fix/`, `docs/`, `chore/`, `security/`, `perf/`, `test/` |
| Devin-specific prefix | `devin/<short-slug>-<task-id>` (e.g. `devin/index-ii-parser-7841`) |
| Base branch | Always `main` unless the task explicitly says otherwise |
| PR title | Conventional Commits (`fix:`, `feat:`, `chore:`) — the orchestrator labels PRs by title regex |
| PR body | Must include **What / Why / Verification** sections — used by reviewers and the orchestrator's sticky comment |
| Draft status | Open draft until **all** verification steps below pass |
| Force-push | Forbidden on shared branches. Allowed only on `devin/*` before first review |

The orchestrator workflow expects category-bearing PR titles. Examples that label correctly:
- `fix: handle null Index II rows in parser` → `bugfix`
- `feat: add Marathi template fallback` → `feature`
- `chore: bump langgraph to 1.0.10rc2` → `chore`
- `security: redact bank account numbers in logs` → `security`

PRs missing a category label fail the `PR Category Guard` workflow.

---

## 4. Risk-Tiered Auto-Merge — What Devin Must Know

PRs are merged by the orchestrator (`.github/workflows/pr-orchestrator.yml`) via GitHub's native auto-merge. Devin must understand the tiers so it doesn't waste cycles waiting for an auto-merge that will never fire:

| Tier | Categories | Behavior |
|------|------------|----------|
| **Auto** | `code-health`, `docs`, `tests`, `chore` | Auto-merges on green CI, non-draft |
| **Size-gated** | `bugfix` | Auto-merges if `additions + deletions < 50`; else blocks |
| **Review-required** | `security`, `feature`, `performance` | Never auto-merges — Devin must request review and wait |

To opt a PR out of auto-merge, apply label **`keep-open`**. To silence the 14-day stale warning without merging, apply `keep-open`. The orchestrator never auto-closes.

---

## 5. Verification Bar ("Done" Definition)

Devin must satisfy **all** of these before flipping a PR out of draft:

1. **Type/lint clean** in the affected subsystem:
   - `ag-platform`: `npm run type-check && npm run lint`
   - `ag-associates-ai/backend`: `python -m pyflakes .` (no test suite exists — see CLAUDE.md §"There is currently no test suite")
2. **Pipeline still runs end-to-end** for the affected agent. The LangGraph pipeline is `aisha → drafter → auditor` with up-to-3-revision feedback. Demonstrate this by running `python main.py` and hitting `POST /api/generate-agreement` with a representative payload.
3. **Diff the behavior** against `main` for non-trivial changes. Capture before/after output (JSON response or generated PDF page-1 screenshot) in the PR body.
4. **Re-read the PR description** and confirm every Test-plan checkbox can actually be ticked. If a step is "TODO: figure out", remove it or downgrade the PR to draft.
5. **No new dependencies** without flagging them in the PR description with the rationale. Pinning matters — see CLAUDE.md §"bleeding-edge".

Devin should NOT mark a task complete just because CI is green. CI here only runs CodeQL + SonarCloud; it does not validate behavior.

---

## 6. Repo-Specific Gotchas (Top 5)

These have bitten previous agent runs. Memorize them or save as Knowledge entries:

1. **Embedding dimension is `384`.** If you swap the SentenceTransformer model, you must update `database/init.sql` (`vector(384)`), `config.py` (`EMBEDDING_DIMENSION`), AND re-run `generate_embeddings.py` AND `docker-compose down -v` to wipe pgvector. Forgetting any one of these silently corrupts RAG.
2. **`process_rental_request()` is synchronous and blocking.** All FastAPI callers wrap it in `asyncio.to_thread(...)`. Do not "fix" this by making the graph async — the LangGraph version pinned here doesn't support it cleanly.
3. **n8n → backend uses `http://host.docker.internal:8001`,** not `localhost`. n8n is in a container; the FastAPI process is on the host.
4. **Frontend `NEXT_PUBLIC_API_URL` is inlined at build time.** Changing the env var after `npm run build` has zero effect — rebuild required.
5. **Three `.env.example` files exist** (`ag-associates-ai/`, `ag-associates-ai/backend/`, `ag-platform/`). They are NOT interchangeable. Copy each into a sibling `.env` before running its parent service.

---

## 7. Communicating Progress

- **Slack first.** Devin's Slack thread is the source of truth for the user. Mirror PR creation, blocker discoveries, and questions there.
- **PR sticky comment** is bot-managed by the orchestrator (marker `<!-- pr-orchestrator-sticky -->`). Do not edit or delete it — Devin's status updates go in regular comments.
- **Ambiguous tasks → ask once, then proceed.** Don't loop. If the user is unreachable for > 30 minutes on a blocking question, Devin should commit the most conservative interpretation as a draft PR and ask in Slack what to adjust.
- **No silent abandonment.** If Devin cannot complete a task, close the draft PR with a comment explaining the blocker and the smallest reproduction.

---

## 8. Self-Improvement

After any user correction:

1. Append the lesson to `tasks/lessons.md` (same file Claude Code uses — Devin and Claude share this).
2. Save a Devin Knowledge entry with the pattern (and a tag like `agassociates`).
3. Reference the lesson on subsequent PRs touching the same area — link to the line in `tasks/lessons.md`.

---

## 9. Things Devin Should NOT Do

- Touch `LICENSE`, `SECURITY.md`, `CNAME`, or `tasks/lessons.md` without explicit instruction (the last contains historical correction records — append-only).
- Merge anyone else's PR. Auto-merge is the orchestrator's job; manual merge is Raj's.
- Rewrite the LangGraph pipeline structure (Aisha → Drafter → Auditor) without an architectural discussion in Slack first.
- Modify any file in `ag-associates-ai/` while a different agent (Jules, Claude Code) has an open PR touching the same file — check `docs/PR_INDEX.md` for overlap before starting.
- Skip pre-commit hooks (`--no-verify`). If a hook fails, fix the underlying issue.
- Push to `main` directly. Ever.

---

## 10. Quick Reference

| Need | Where |
|------|-------|
| Repo layout + commands | [`CLAUDE.md`](./CLAUDE.md) |
| Production deploy steps | [`DEPLOYMENT_PLAYBOOK.md`](./DEPLOYMENT_PLAYBOOK.md) |
| Coding standards | [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`*_GUIDELINES.md`](./) |
| Live PR state | `docs/PR_INDEX.md` + the `PR Orchestration Dashboard` issue |
| Trend metrics | `docs/PR_METRICS.csv` (one row per orchestrator run) |
| Orchestrator config | `.github/orchestrator.config.json` |
| Labeler rules | `.github/labeler-rules.json` |

---

_If Devin discovers this playbook is wrong or incomplete, open a `docs:`-prefixed PR updating it. The playbook is meant to be edited — that's how the lessons accumulate._
