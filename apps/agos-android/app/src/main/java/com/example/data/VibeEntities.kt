package com.example.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pull_requests")
data class PullRequest(
    @PrimaryKey val id: Int,
    val title: String,
    val author: String,
    val category: String, // "docs", "refactor", "feature", "fix", "emergency", "chore"
    val riskTier: String, // "LOW", "MEDIUM", "HIGH", "CRITICAL"
    val status: String,    // "Ready", "Review", "Tests", "Urgent", "Deployed"
    val mergeStatus: String, // "Auto", "Manual", "Immediate", "Completed"
    val deployStatus: String, // "Immediate", "Tests pass", "24h hold", "Blocked"
    val description: String = "",
    val diffText: String = "",
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "deployment_runs")
data class DeploymentRun(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val commitSha: String,
    val prNumber: Int,
    val serviceName: String, // "ag-platform", "ai-backend", "intake-api", etc.
    val status: String,      // "Success", "Rolled back", "Deploying"
    val timestamp: Long = System.currentTimeMillis(),
    val duration: String,    // e.g. "2m 14s"
    val logData: String      // Full execution logs of build & smoke tests
)

@Entity(tableName = "orchestrator_log")
data class OrchestratorLog(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val timestamp: Long = System.currentTimeMillis(),
    val agentName: String,   // "Claude", "Devin", "Jules", "VibeCodeing Bot", "Orchestrator"
    val message: String,
    val type: String         // "info", "success", "error", "warning"
)
