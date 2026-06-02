package com.example.data

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.flow.take

class VibeRepository(private val dao: VibeDao) {

    val allPullRequests: Flow<List<PullRequest>> = dao.getAllPullRequests()
    val allDeploymentRuns: Flow<List<DeploymentRun>> = dao.getAllDeploymentRuns()
    val recentLogs: Flow<List<OrchestratorLog>> = dao.getRecentLogs()

    suspend fun insertPR(pr: PullRequest) = dao.insertPullRequest(pr)
    suspend fun deletePR(pr: PullRequest) = dao.deletePullRequest(pr)
    suspend fun deletePRById(id: Int) = dao.deletePullRequestById(id)

    suspend fun insertRun(run: DeploymentRun) = dao.insertDeploymentRun(run)
    suspend fun clearRuns() = dao.clearDeploymentRuns()

    suspend fun insertLog(log: OrchestratorLog) = dao.insertLog(log)
    suspend fun clearLogs() = dao.clearLogs()

    // Seeds initial data if the database is currently empty
    suspend fun seedDatabase() {
        val currentPrs = dao.getAllPullRequests().take(1).firstOrNull() ?: emptyList()
        if (currentPrs.isEmpty()) {
            // Seed PRs
            val seededPrs = listOf(
                PullRequest(
                    id = 42,
                    title = "docs: update API endpoints",
                    author = "@rajkhemani",
                    category = "docs",
                    riskTier = "LOW",
                    status = "Ready",
                    mergeStatus = "Auto",
                    deployStatus = "Immediate",
                    description = "Adds full description documentation for the new API webhook pathways on ag-associates-ai.",
                    diffText = "diff --git a/docs/API.md b/docs/API.md\n+ ## Webhook REST endpoints\n+ All endpoints are exposed on port 8000."
                ),
                PullRequest(
                    id = 43,
                    title = "refactor: extract embedding logic",
                    author = "@claude",
                    category = "refactor",
                    riskTier = "MEDIUM",
                    status = "Ready",
                    mergeStatus = "Auto",
                    deployStatus = "Tests pass",
                    description = "Extracts embedding logic to a shared wrapper to prevent code duplication when swapping models.",
                    diffText = "diff --git a/embedding.py b/embedding.py\n- def make_emb(txt):\n-     # old code\n+ class SharedEmbedder:\n+     def get_dim(self): return 384"
                ),
                PullRequest(
                    id = 44,
                    title = "feat: add case state machine",
                    author = "@devin",
                    category = "feature",
                    riskTier = "HIGH",
                    status = "Review",
                    mergeStatus = "Manual",
                    deployStatus = "24h hold",
                    description = "Adds state machine representation of bank litigation files to handle complex transitions safely.",
                    diffText = "diff --git a/state.ts b/state.ts\n+ export enum CaseState {\n+     INTAKE = 'INTAKE',\n+     AUDITING = 'AUDITING',\n+ }"
                ),
                PullRequest(
                    id = 45,
                    title = "fix: connection leak in templates RAG",
                    author = "@jules",
                    category = "fix",
                    riskTier = "MEDIUM",
                    status = "Ready",
                    mergeStatus = "Auto",
                    deployStatus = "Tests pass",
                    description = "Ensures connections are properly returned to the pgvector pool during bulk similarities.",
                    diffText = "diff --git a/db.py b/db.py\n  with pool.get_conn() as conn:\n-     conn.execute(sql)\n+     try:\n+         conn.execute(sql)\n+     finally:\n+         conn.close()"
                ),
                PullRequest(
                    id = 46,
                    title = "HOTFIX: pgvector mismatch breaking intake",
                    author = "@rajkhemani",
                    category = "emergency",
                    riskTier = "CRITICAL",
                    status = "Urgent",
                    mergeStatus = "Manual",
                    deployStatus = "Immediate",
                    description = "Critical conflict Resolution: Aligns postgres dimension schema with Qwen Sentence Transformer dimensional outputs (384).",
                    diffText = "diff --git a/init.sql b/init.sql\n- embedding vector(768)\n+ embedding vector(384)"
                ),
                PullRequest(
                    id = 47,
                    title = "feat: mobile PWA for field execs",
                    author = "@claude",
                    category = "feature",
                    riskTier = "HIGH",
                    status = "Tests",
                    mergeStatus = "Manual",
                    deployStatus = "Blocked",
                    description = "Experimental local PWA layout to assist field agents in submitting land titles offline.",
                    diffText = "diff --git a/manifest.json b/manifest.json\n+ {\n+   'name': 'OS Field Agent',\n+   'short_name': 'Launcher'\n+ }"
                ),
                PullRequest(
                    id = 48,
                    title = "chore: bump dependencies",
                    author = "@dependabot",
                    category = "chore",
                    riskTier = "LOW",
                    status = "Ready",
                    mergeStatus = "Auto",
                    deployStatus = "Immediate",
                    description = "Bumps Next.js and Tailwind to keep ahead of minor security reports.",
                    diffText = "diff --git a/package.json b/package.json\n- 'next': '15.0.1'\n+ 'next': '15.0.3'"
                )
            )
            dao.insertPullRequests(seededPrs)

            // Seed runs
            val seededRuns = listOf(
                DeploymentRun(
                    commitSha = "a1b2c3d",
                    prNumber = 42,
                    serviceName = "ag-platform",
                    status = "Success",
                    timestamp = System.currentTimeMillis() - 3600000,
                    duration = "2m 14s",
                    logData = "Pulling registry images...\nBuilding ag-platform assets...\nStatic Next inlining completed.\nHealth Check GET /api/health returned 200.\nDeploy Completed Successfully!"
                ),
                DeploymentRun(
                    commitSha = "e4f5g6h",
                    prNumber = 41,
                    serviceName = "ai-backend",
                    status = "Success",
                    timestamp = System.currentTimeMillis() - 7200000,
                    duration = "1m 58s",
                    logData = "Setting up LangGraph node context...\nInitializing vector connection dimension: 384.\nvLLM connectivity check: success\nSmoke tests verifying model answer: success!"
                ),
                DeploymentRun(
                    commitSha = "i7j8k9l",
                    prNumber = 39,
                    serviceName = "intake-api",
                    status = "Rolled back",
                    timestamp = System.currentTimeMillis() - 10800000,
                    duration = "3m 42s",
                    logData = "Initiating database schemas migrations...\nFastify container booting on port 9000.\nService health probe: GET /health.\nError: timed out waiting for postgres SELECT 1.\nRolling back to previous stable release: version o5p9m2k!"
                )
            )
            for (run in seededRuns) {
                dao.insertDeploymentRun(run)
            }

            // Seed logs
            val seededLogs = listOf(
                OrchestratorLog(
                    agentName = "VibeCodeing Bot",
                    message = "System initialized and ready. Monitoring 6 active service pipelines.",
                    type = "info",
                    timestamp = System.currentTimeMillis() - 15000000
                ),
                OrchestratorLog(
                    agentName = "Jules",
                    message = "Resolved memory connection leaks in pgvector pool for templates RAG.",
                    type = "success",
                    timestamp = System.currentTimeMillis() - 12000000
                ),
                OrchestratorLog(
                    agentName = "Claude",
                    message = "Analyzing refactor changes for embedding.py. Classified risk as MEDIUM.",
                    type = "info",
                    timestamp = System.currentTimeMillis() - 9000000
                ),
                OrchestratorLog(
                    agentName = "Orchestrator",
                    message = "Health check failure on intake-api: timeout waiting for response. Automatically triggered rollback.",
                    type = "error",
                    timestamp = System.currentTimeMillis() - 6000000
                ),
                OrchestratorLog(
                    agentName = "VibeCodeing Bot",
                    message = "Deploy completed successfully for SHA a1b2c3d on VPS master nodes.",
                    type = "success",
                    timestamp = System.currentTimeMillis() - 1800000
                )
            )
            for (log in seededLogs) {
                dao.insertLog(log)
            }
        }
    }
}
