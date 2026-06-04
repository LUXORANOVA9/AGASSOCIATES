# Lessons Learned

## Bug Patterns

- **`register_vector()` must receive a connection**: Calling `register_vector()` with no args (or at module level before any connection exists) causes `TypeError`. Always: connect first → `register_vector(conn)` → then query.

- **Never clear `state['errors']` on success**: Agent nodes were resetting `state['errors'] = []` when they succeeded, wiping errors from previous nodes. Errors must persist through the entire pipeline execution.

- **Embedding dimension must be consistent in 3 places**: `config.py` (`EMBEDDING_DIMENSION`), `database/init.sql` (`vector(N)`), and `.env.example`. Changing one without the others causes silent RAG failures or INSERT errors.

- **Use portable paths, not hardcoded OS paths**: `OUTPUT_DIR` was hardcoded to `/workspace/ag-associates-ai/output/` (Linux-only). Use `os.path.join(os.path.dirname(__file__), "..", "output")` for cross-platform compatibility.

- **Always `try/finally` for database connections**: Any endpoint that opens a DB connection must close it in a `finally` block — even if an exception occurs. Without this, connections leak under error conditions.

## Process Patterns

- **Don't push directly to main**: Create a feature branch (`fix/...`, `feat/...`, `docs/...`) and open a PR. This creates an audit trail and allows review.

- **Backtest after every change batch**: Run validation checks across all modified files before committing — dimension alignment, import usage, config consistency. Catching bugs in bulk is cheaper than fixing them one at a time.

- **Documentation paths go stale**: Markdown docs (LANGGRAPH_AGENTS.md, DAY3_COMPLETE.md) referenced `/workspace/` paths and old dependency versions. Always update docs alongside code changes.

- **Git must be in system PATH before Antigravity starts**: `setx /M` only affects new processes. If Antigravity was running when PATH was updated, it won't see `git` until restarted.

## Production Patterns

- **NeSL endpoint was accidentally deleted when NOI endpoints were added**: The frontend dashboard still called `POST /api/nesl/execute` but the route was missing from `main.py`. After any large route refactor, validate that all routes referenced by frontend still exist.

- **Never hardcode Playwright selectors**: Government portals change DOM structure frequently. All selectors in `igr_executor.py` and `executor_agent.py` are now configurable via `IGR_SEL_*` and `GRAS_SEL_*` env vars so production can be patched without code deploys.

- **NeSL e-filing needs 3 fallback modes**: API (when NeSL credentials exist), RPA (when IGR portal credentials exist), Mock (when neither exists). The `nesl_client.py` auto-selects mode at init time so the frontend always gets a response regardless of credential availability.

- **FastAPI Request object for legacy endpoints**: When an endpoint needs to accept both JSON bodies AND empty POST (no body, no Content-Type), use `fastapi.Request` with a manual `try: await request.json()` fallback instead of a Pydantic model parameter. Models with `= None` still fail on empty body POSTs.

- **Docker Compose volumes for document uploads**: When Playwright RPA needs to upload files (sanction letters, KYC docs), the container filesystem must be mapped via a named volume (`ag_documents`). Plain host paths won't survive container restarts or multi-node deploys.
