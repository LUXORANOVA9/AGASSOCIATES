package com.example.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface VibeDao {
    // --- Pull Requests ---
    @Query("SELECT * FROM pull_requests ORDER BY timestamp DESC")
    fun getAllPullRequests(): Flow<List<PullRequest>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPullRequest(pr: PullRequest)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPullRequests(list: List<PullRequest>)

    @Delete
    suspend fun deletePullRequest(pr: PullRequest)

    @Query("DELETE FROM pull_requests WHERE id = :id")
    suspend fun deletePullRequestById(id: Int)

    // --- Deployment Runs ---
    @Query("SELECT * FROM deployment_runs ORDER BY timestamp DESC")
    fun getAllDeploymentRuns(): Flow<List<DeploymentRun>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertDeploymentRun(run: DeploymentRun)

    @Query("DELETE FROM deployment_runs")
    suspend fun clearDeploymentRuns()

    // --- Orchestrator Logs ---
    @Query("SELECT * FROM orchestrator_log ORDER BY timestamp DESC LIMIT 100")
    fun getRecentLogs(): Flow<List<OrchestratorLog>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertLog(log: OrchestratorLog)

    @Query("DELETE FROM orchestrator_log")
    suspend fun clearLogs()
}
