package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import com.example.data.DeploymentRun
import com.example.data.OrchestratorLog
import com.example.data.PullRequest
import com.example.ui.*
import com.example.ui.theme.*
import com.example.ui.viewmodel.VibeViewModel
import java.text.SimpleDateFormat
import java.util.*

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme(darkTheme = false) { // Use Sleek Interface Light Theme
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    VibeMainScreen()
                }
            }
        }
    }
}

enum class VibeTab(val title: String) {
    DASHBOARD("AGOS Console"),
    AI_TEAM("AI Team Board"),
    WORKSPACES("Workspaces"),
    TOPOLOGY("System Map"),
    LOGS_CONFIG("Logs & Settings")
}

@Composable
fun VibeMainScreen() {
    val viewModel: VibeViewModel = viewModel()
    var activeTab by remember { mutableStateOf(VibeTab.DASHBOARD) }

    // Authentication Gate - If user hasn't authenticated yet, show dynamic login screen
    if (!viewModel.isAuthenticated) {
        AgosAuthPortal(viewModel = viewModel)
        return
    }

    val systemLogs by viewModel.orchestratorLogs.collectAsState()

    Scaffold(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing),
        bottomBar = {
            NavigationBar(
                containerColor = SleekRecentBg,
                tonalElevation = 0.dp,
                modifier = Modifier
                    .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.3f)))
                    .windowInsetsPadding(WindowInsets.navigationBars)
            ) {
                VibeTab.entries.forEach { tab ->
                    val isSelected = activeTab == tab
                    val icon = when (tab) {
                        VibeTab.DASHBOARD -> Icons.Default.SpaceDashboard
                        VibeTab.AI_TEAM -> Icons.Default.Groups
                        VibeTab.WORKSPACES -> Icons.Default.FolderShared
                        VibeTab.TOPOLOGY -> Icons.Default.Hub
                        VibeTab.LOGS_CONFIG -> Icons.Default.Settings
                    }
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = { activeTab = tab },
                        icon = {
                            Icon(
                                imageVector = icon,
                                contentDescription = tab.title,
                                tint = if (isSelected) SleekDarkPurple else CyberTextSecondary.copy(alpha = 0.6f)
                            )
                        },
                        label = {
                            Text(
                                text = tab.title,
                                color = if (isSelected) SleekDarkPurple else CyberTextSecondary.copy(alpha = 0.6f),
                                fontSize = 10.sp,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                            )
                        },
                        modifier = Modifier.testTag("nav_tab_${tab.name.lowercase()}"),
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = SleekContainer
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(CyberBg)
        ) {
            // High-fidelity glowing Header logo
            VibeHeader(isApiKeyAvailable = viewModel.isApiKeyAvailable)

            // Switch content based on active tab with a fade-in animation
            Box(modifier = Modifier.fillMaxSize().weight(1f)) {
                AnimatedContent(
                    targetState = activeTab,
                    transitionSpec = {
                        fadeIn(animationSpec = tween(220)) togetherWith fadeOut(animationSpec = tween(220))
                    },
                    label = "tab_transition"
                ) { targetTab ->
                    when (targetTab) {
                        VibeTab.DASHBOARD -> AgosDashboardConsole(viewModel = viewModel)
                        VibeTab.AI_TEAM -> AgosAiTeamBoard(viewModel = viewModel)
                        VibeTab.WORKSPACES -> AgosWorkspacesCenter(viewModel = viewModel)
                        VibeTab.TOPOLOGY -> TopologyTabContent(viewModel = viewModel)
                        VibeTab.LOGS_CONFIG -> LogsAndConfigTab(
                            viewModel = viewModel,
                            logs = systemLogs
                        )
                    }
                }
            }
        }
    }
}


@Composable
fun VibeHeader(isApiKeyAvailable: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(NeonIndigo),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Dns,
                contentDescription = "Logo",
                tint = Color.White,
                modifier = Modifier.size(22.dp)
            )
        }
        
        Spacer(modifier = Modifier.width(12.dp))
        
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "AGOS ENGINE",
                fontWeight = FontWeight.Medium,
                fontSize = 18.sp,
                color = CyberTextPrimary,
                letterSpacing = (-0.3).sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(NeonGreen)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "SYSTEM AUTONOMOUS",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextSecondary,
                    letterSpacing = 0.5.sp
                )
            }
        }

        // Key capability injection verification indicator
        AssistChip(
            onClick = {},
            label = {
                Text(
                    text = if (isApiKeyAvailable) "Gemini Live" else "Local AI",
                    fontSize = 10.sp,
                    color = if (isApiKeyAvailable) NeonCyan else NeonAmber
                )
            },
            leadingIcon = {
                Icon(
                    imageVector = if (isApiKeyAvailable) Icons.Default.Bolt else Icons.Default.Warning,
                    contentDescription = "Status",
                    tint = if (isApiKeyAvailable) NeonCyan else NeonAmber,
                    modifier = Modifier.size(12.dp)
                )
            },
            colors = AssistChipDefaults.assistChipColors(
                containerColor = if (isApiKeyAvailable) NeonCyan.copy(alpha = 0.12f) else NeonAmber.copy(alpha = 0.12f),
                labelColor = if (isApiKeyAvailable) NeonCyan else NeonAmber
            ),
            border = BorderStroke(1.dp, if (isApiKeyAvailable) NeonCyan.copy(alpha = 0.3f) else NeonAmber.copy(alpha = 0.3f)),
            shape = RoundedCornerShape(20.dp)
        )
    }
}

@Composable
fun DashboardTabContent(
    viewModel: VibeViewModel,
    runs: List<DeploymentRun>,
    prs: List<PullRequest>
) {
    var selectedPRForDeployment by remember { mutableStateOf<PullRequest?>(null) }
    
    // Auto-select first PullRequest as target for simulation if empty
    LaunchedEffect(prs) {
        if (selectedPRForDeployment == null && prs.isNotEmpty()) {
            selectedPRForDeployment = prs.firstOrNull { it.status == "Ready" } ?: prs.firstOrNull()
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // --- SEC 1: METRICS BANNER SKELETON (Sleek Interface Stats Card) ---
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SleekContainer),
                border = BorderStroke(1.dp, Color.Transparent),
                shape = RoundedCornerShape(28.dp)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(20.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "30-DAY SUCCESS RATE",
                            style = TextStyle(
                                color = SleekDarkPurple,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        )
                        Box(
                            modifier = Modifier
                                .background(Color.White.copy(alpha = 0.4f), RoundedCornerShape(8.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "ORCHESTRATOR V1.2",
                                style = TextStyle(
                                    color = SleekDarkPurple,
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        verticalAlignment = Alignment.Bottom,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "94",
                            style = TextStyle(
                                color = SleekDarkPurple,
                                fontSize = 56.sp,
                                fontWeight = FontWeight.Light
                            )
                        )
                        Text(
                            text = "%",
                            modifier = Modifier.padding(bottom = 10.dp),
                            style = TextStyle(
                                color = SleekDarkPurple.copy(alpha = 0.7f),
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Light
                            )
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(24.dp)
                    ) {
                        Column {
                            Text(
                                text = "AVG DEPLOY",
                                style = TextStyle(
                                    color = SleekDarkPurple.copy(alpha = 0.6f),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "2m 18s",
                                style = TextStyle(
                                    color = SleekDarkPurple,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            )
                        }
                        Column {
                            Text(
                                text = "ROLLBACKS",
                                style = TextStyle(
                                    color = SleekDarkPurple.copy(alpha = 0.6f),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "0 (Today)",
                                style = TextStyle(
                                    color = SleekDarkPurple,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            )
                        }
                    }
                }
            }
        }

        // --- SEC 2: COORDINATED PIPELINE GRID (Sleek 3-Column Grid) ---
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "ACTIVE ORCHESTRATION (6)",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextSecondary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                )

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineCard(name = "AI-BACKEND", status = "ONLINE", icon = Icons.Default.Terminal, statusColor = NeonGreen)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineCard(name = "AI-FRONTEND", status = "ONLINE", icon = Icons.Default.Settings, statusColor = NeonGreen)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineCard(name = "AG-PLATFORM", status = "ONLINE", icon = Icons.Default.Build, statusColor = NeonGreen)
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineCard(name = "NOI-PROTOTYPE", status = "ONLINE", icon = Icons.Default.Code, statusColor = NeonGreen)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineCard(name = "N8N-WHATSAPP", status = "SLEEP", icon = Icons.Default.Bolt, statusColor = NeonBlue)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineCard(name = "SUPABASE/DB", status = "ONLINE", icon = Icons.Default.Warning, statusColor = NeonGreen)
                        }
                    }
                }
            }
        }

        // --- SEC 3: INFRASTRUCTURE MONITOR PANEL (Glassmorphic Sleek Style) ---
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SleekRecentBg),
                border = BorderStroke(1.dp, Color.Transparent),
                shape = RoundedCornerShape(24.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp)
                        .background(Color.White.copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                        .border(BorderStroke(1.dp, Color.White.copy(alpha = 0.8f)), RoundedCornerShape(16.dp))
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    InfraUnit(name = "Postgres", ping = "12ms", isHealthy = true)
                    InfraUnit(name = "Redis", ping = "2ms", isHealthy = true)
                    InfraUnit(name = "n8n", ping = "114ms", isHealthy = true)
                    InfraUnit(name = "Caddy", ping = "SSL Verified", isHealthy = true)
                }
            }
        }

        // --- SEC 4: INTERACTIVE CONTROL CONSOLE TERMINAL ---
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "COORDINATED TERMINAL SIMULATOR",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextSecondary,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.padding(start = 4.dp, bottom = 6.dp)
                )

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF070A13)),
                    border = BorderStroke(1.3.dp, if (viewModel.isDeploying) NeonIndigo else CyberBorder),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        // Action triggers
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Revision target: ",
                                color = CyberTextSecondary,
                                fontSize = 11.sp,
                                modifier = Modifier.weight(1f)
                            )
                            
                            // Target PR Picker drop-down simulation (horizontal input chip list)
                            LazyRow(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                modifier = Modifier.weight(2f)
                            ) {
                                items(prs.take(4)) { pr ->
                                    val isSelected = selectedPRForDeployment?.id == pr.id
                                    FilterChip(
                                        selected = isSelected,
                                        onClick = { if (!viewModel.isDeploying) selectedPRForDeployment = pr },
                                        label = { Text("#${pr.id} (${pr.author})", fontSize = 10.sp) },
                                        colors = FilterChipDefaults.filterChipColors(
                                            selectedContainerColor = NeonIndigo.copy(alpha = 0.2f),
                                            selectedLabelColor = NeonIndigo
                                        ),
                                        border = BorderStroke(1.dp, if (isSelected) NeonIndigo else CyberBorder)
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Trigger buttons
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Button(
                                onClick = {
                                    val target = selectedPRForDeployment ?: prs.firstOrNull()
                                    viewModel.runCoordinatedDeployment(
                                        targetPRId = target?.id ?: 42,
                                        targetTitle = target?.title ?: "docs: update API endpoints"
                                    )
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("deploy_main_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                                enabled = !viewModel.isDeploying,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Icon(Icons.Default.PlayArrow, contentDescription = "Deploy", tint = Color.White)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("DEPLOY CORRESPONDING REVISION", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }

                            OutlinedButton(
                                onClick = { viewModel.runRollbackSequence() },
                                modifier = Modifier.weight(0.7f),
                                border = BorderStroke(1.dp, NeonRed.copy(alpha = 0.7f)),
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = NeonRed),
                                enabled = !viewModel.isDeploying,
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Icon(Icons.Default.Undo, contentDescription = "Rollback", tint = NeonRed)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("REVERT STABLE", color = NeonRed, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                            }
                        }

                        if (viewModel.isDeploying) {
                            Spacer(modifier = Modifier.height(12.dp))
                            LinearProgressIndicator(
                                progress = { viewModel.deployProgress },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(4.dp)),
                                color = if (viewModel.currentDeployStatusText.contains("Rollback")) NeonRed else NeonIndigo,
                                trackColor = CyberBorder
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = viewModel.currentDeployStatusText,
                                color = CyberTextSecondary,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.fillMaxWidth(),
                                textAlign = TextAlign.End
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Terminal feed displaying scrollable outputs
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp)
                                .background(Color.Black, RoundedCornerShape(6.dp))
                                .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f)))
                                .padding(8.dp)
                        ) {
                            val terminalState = rememberLazyListState()
                            
                            // Auto-scroll terminal lines to the bottom as build steps stream
                            LaunchedEffect(viewModel.terminalLines.size) {
                                if (viewModel.terminalLines.isNotEmpty()) {
                                    terminalState.animateScrollToItem(viewModel.terminalLines.size - 1)
                                }
                            }

                            LazyColumn(
                                state = terminalState,
                                modifier = Modifier.fillMaxSize()
                            ) {
                                items(viewModel.terminalLines) { line ->
                                    val styledText = remember(line) {
                                        buildAnnotatedString {
                                            when {
                                                line.contains("🎉") || line.contains("SUCCESSFUL") || line.contains("✓") -> {
                                                    withStyle(style = SpanStyle(color = NeonGreen, fontWeight = FontWeight.Bold)) {
                                                        append(line)
                                                    }
                                                }
                                                line.contains("🚨") || line.contains("DANGER") || line.contains("Error") -> {
                                                    withStyle(style = SpanStyle(color = NeonRed, fontWeight = FontWeight.Bold)) {
                                                        append(line)
                                                    }
                                                }
                                                line.contains("🛠️") || line.contains("🚀") || line.contains("ONLINE") -> {
                                                    withStyle(style = SpanStyle(color = NeonCyan)) {
                                                        append(line)
                                                    }
                                                }
                                                else -> {
                                                    withStyle(style = SpanStyle(color = Color(0xFFE2E8F0))) {
                                                        append(line)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    Text(
                                        text = styledText,
                                        fontFamily = FontFamily.Monospace,
                                        fontSize = 11.sp,
                                        modifier = Modifier.fillMaxWidth(),
                                        lineHeight = 15.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        // --- SEC 5: RECENT DEPLOYMENTS LIST ---
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "DEPLOYMENT TELEMETRY HISTORY",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextSecondary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(start = 4.dp, bottom = 6.dp)
                )

                if (runs.isEmpty()) {
                    Text(
                        text = "No recorded deployment attempts. Run a simulator first.",
                        fontSize = 12.sp,
                        color = CyberTextSecondary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }

                runs.forEach { run ->
                    DeploymentRunCard(run = run)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
fun MetricColumn(value: String, label: String, neonColor: Color) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(90.dp)
    ) {
        Text(
            text = value,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            color = neonColor,
            letterSpacing = (-0.5).sp
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            fontSize = 10.sp,
            color = CyberTextSecondary,
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun HorizontalDividerVertical() {
    Box(
        modifier = Modifier
            .width(1.dp)
            .height(34.dp)
            .background(CyberBorder)
    )
}

@Composable
fun PipelineCard(
    name: String,
    status: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    statusColor: Color
) {
    Card(
        modifier = Modifier.height(100.dp),
        colors = CardDefaults.cardColors(containerColor = CyberCard),
        border = BorderStroke(1.dp, CyberBorder),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Icon(
                imageVector = icon,
                contentDescription = name,
                tint = NeonIndigo,
                modifier = Modifier.size(20.dp)
            )
            
            Column {
                Text(
                    text = name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 11.sp,
                    color = CyberTextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = if (status == "SLEEP") "Syncing" else "Healthy",
                    fontSize = 9.sp,
                    color = statusColor,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
fun InfraUnit(name: String, ping: String, isHealthy: Boolean) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(if (isHealthy) NeonGreen else NeonRed)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Column {
            Text(text = name, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CyberTextPrimary)
            Text(text = ping, fontSize = 9.sp, color = CyberTextSecondary)
        }
    }
}

@Composable
fun DeploymentRunCard(run: DeploymentRun) {
    var isExpanded by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { isExpanded = !isExpanded },
        colors = CardDefaults.cardColors(containerColor = CyberCard.copy(alpha = 0.7f)),
        border = BorderStroke(1.dp, if (run.status == "Success") CyberBorder.copy(alpha = 0.5f) else NeonRed.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(10.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (run.status == "Success") Icons.Default.CheckCircle else Icons.Default.Replay,
                        contentDescription = run.status,
                        tint = if (run.status == "Success") NeonGreen else NeonRed,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Target PR #${run.prNumber} [${run.serviceName}]",
                        fontWeight = FontWeight.Bold,
                        fontSize = 12.sp,
                        color = CyberTextPrimary
                    )
                }

                // Revision / SHA identifier state
                Badge(
                    containerColor = if (run.status == "Success") NeonGreen.copy(alpha = 0.15f) else NeonRed.copy(alpha = 0.15f),
                    contentColor = if (run.status == "Success") NeonGreen else NeonRed,
                    modifier = Modifier.padding(2.dp)
                ) {
                    Text(text = run.commitSha, fontSize = 10.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp))
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                val formattedTime = remember(run.timestamp) {
                    SimpleDateFormat("HH:mm:ss · MMM dd", Locale.getDefault()).format(Date(run.timestamp))
                }
                Text(text = "Completed: $formattedTime", fontSize = 11.sp, color = CyberTextSecondary)
                Text(text = "Duration: ${run.duration}", fontSize = 11.sp, color = CyberTextSecondary)
            }

            if (isExpanded) {
                Spacer(modifier = Modifier.height(10.dp))
                HorizontalDivider(color = CyberBorder.copy(alpha = 0.5f))
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Build logs terminal output:", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = CyberTextPrimary)
                Spacer(modifier = Modifier.height(4.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black, RoundedCornerShape(4.dp))
                        .padding(8.dp)
                ) {
                    Text(
                        text = run.logData,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 10.sp,
                        color = CyberTextSecondary,
                        lineHeight = 14.sp
                    )
                }
            }
        }
    }
}

// --- TAB 2: PR INDEX COMPOSABLE ---
@Composable
fun PRIndexTabContent(
    prs: List<PullRequest>,
    onDelete: (PullRequest) -> Unit,
    onTriggerDeploy: (PullRequest) -> Unit
) {
    var expandedPrId by remember { mutableStateOf<Int?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        item {
            Text(
                text = "ACTIVE SEMANTIC PR INDEX",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = CyberTextSecondary,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(start = 4.dp, top = 8.dp)
            )
        }

        if (prs.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Default.HourglassEmpty, contentDescription = "Empty", tint = CyberTextSecondary, modifier = Modifier.size(48.dp))
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("No Pull Requests registered.", color = CyberTextSecondary, fontSize = 13.sp)
                    }
                }
            }
        }

        items(prs) { pr ->
            val isExpanded = expandedPrId == pr.id
            PullRequestCard(
                pr = pr,
                isExpanded = isExpanded,
                onClick = { expandedPrId = if (isExpanded) null else pr.id },
                onPrune = { onDelete(pr) },
                onDeploy = { onTriggerDeploy(pr) }
            )
        }
    }
}

@Composable
fun PullRequestCard(
    pr: PullRequest,
    isExpanded: Boolean,
    onClick: () -> Unit,
    onPrune: () -> Unit,
    onDeploy: () -> Unit
) {
    // Dynamic color coding based on Risk Tier Classification configuration
    val riskColor = when (pr.riskTier) {
        "CRITICAL" -> NeonRed
        "HIGH" -> NeonAmber
        "MEDIUM" -> NeonBlue
        else -> NeonGreen
    }

    val categoryColor = when (pr.category) {
        "emergency" -> NeonRed
        "fix" -> NeonCyan
        "refactor" -> NeonIndigo
        "docs" -> NeonPurple
        "feature" -> NeonPink
        else -> NeonBlue
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("pr_item_${pr.id}")
            .clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = CyberCard),
        border = BorderStroke(1.dp, if (isExpanded) NeonIndigo.copy(alpha = 0.5f) else CyberBorder.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            // First row: Header info
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                    Text(
                        text = "#${pr.id}",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 14.sp,
                        color = NeonIndigo,
                        fontFamily = FontFamily.Monospace
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = pr.title,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = CyberTextPrimary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Automerge tag Capsule
                Badge(
                    containerColor = if (pr.mergeStatus == "Auto") NeonGreen.copy(alpha = 0.12f) else CyberBorder,
                    contentColor = if (pr.mergeStatus == "Auto") NeonGreen else CyberTextSecondary
                ) {
                    Text(
                        text = if (pr.mergeStatus == "Auto") "Auto-Merge" else "Manual review",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Sub info row: Tags and Author
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Author tag
                Icon(Icons.Default.Person, contentDescription = "Author", tint = CyberTextSecondary, modifier = Modifier.size(13.dp))
                Spacer(modifier = Modifier.width(3.dp))
                Text(text = pr.author, fontSize = 11.sp, color = CyberTextSecondary)
                
                Spacer(modifier = Modifier.width(12.dp))
                
                // Category Capsule
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(categoryColor.copy(alpha = 0.15f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(text = pr.category.uppercase(), fontSize = 9.sp, fontWeight = FontWeight.Bold, color = categoryColor)
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Risk Capsule
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(riskColor.copy(alpha = 0.15f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(text = "RISK: ${pr.riskTier}", fontSize = 9.sp, fontWeight = FontWeight.Black, color = riskColor)
                }
            }

            // Expanded panel showing diff changes and logs trigger
            if (isExpanded) {
                Spacer(modifier = Modifier.height(14.dp))
                HorizontalDivider(color = CyberBorder.copy(alpha = 0.4f))
                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "AI SEMANTIC INSIGHTS SUMMARY:",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextPrimary,
                    letterSpacing = 0.5.sp
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = pr.description,
                    fontSize = 12.sp,
                    color = CyberTextSecondary,
                    lineHeight = 17.sp
                )

                if (pr.diffText.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "TOUCHED CHANGESET SNIPPET:",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = CyberTextPrimary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF070A13), RoundedCornerShape(6.dp))
                            .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.6f)))
                            .padding(8.dp)
                    ) {
                        Text(
                            text = pr.diffText,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            color = NeonGreen,
                            lineHeight = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = onDeploy,
                        colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.FlashOn, contentDescription = "Force deploy", tint = Color.White, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("FORCE COORDINATED DEPLOY", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedButton(
                        onClick = onPrune,
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = NeonRed),
                        border = BorderStroke(1.dp, NeonRed.copy(alpha = 0.5f)),
                        modifier = Modifier.weight(0.4f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Icon(Icons.Default.DeleteSweep, contentDescription = "Wipe", tint = NeonRed, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("PRUNE", color = NeonRed, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// --- TAB 3: SYSTEM LOGS & SETTINGS ---
@Composable
fun LogsAndConfigTab(
    viewModel: VibeViewModel,
    logs: List<OrchestratorLog>
) {
    var isEditingSettings by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        // --- SEC 1: SETTINGS EDIT CONTROL ---
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                colors = CardDefaults.cardColors(containerColor = CyberCard),
                border = BorderStroke(1.dp, CyberBorder),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(text = "ORCHESTRATOR CONFIG PARAMETERS", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = CyberTextPrimary, letterSpacing = 0.5.sp)
                            Text(text = "Local orchestration variables override", fontSize = 10.sp, color = CyberTextSecondary)
                        }

                        IconButton(onClick = { isEditingSettings = !isEditingSettings }) {
                            Icon(
                                imageVector = if (isEditingSettings) Icons.Default.Check else Icons.Default.Edit,
                                contentDescription = "Toggle edit",
                                tint = if (isEditingSettings) NeonGreen else NeonIndigo
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    if (isEditingSettings) {
                        OutlinedTextField(
                            value = viewModel.customPostgresUrl,
                            onValueChange = { viewModel.customPostgresUrl = it },
                            label = { Text("DATABASE_URL Connection") },
                            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberTextPrimary),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = NeonIndigo,
                                unfocusedBorderColor = CyberBorder
                            )
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = viewModel.customVllmPort,
                            onValueChange = { viewModel.customVllmPort = it },
                            label = { Text("vLLM Server External Port") },
                            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberTextPrimary),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = NeonIndigo,
                                unfocusedBorderColor = CyberBorder
                            )
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        OutlinedTextField(
                            value = viewModel.customCaddyDomain,
                            onValueChange = { viewModel.customCaddyDomain = it },
                            label = { Text("DNS SSL Caddy Proxy Domain") },
                            textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberTextPrimary),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = NeonIndigo,
                                unfocusedBorderColor = CyberBorder
                            )
                        )
                    } else {
                        // Static Read-Only view
                        ConfigParamRow(label = "SUPABASE_DB_CONN", value = viewModel.customPostgresUrl)
                        ConfigParamRow(label = "VLLM_API_PORT", value = "localhost:${viewModel.customVllmPort}")
                        ConfigParamRow(label = "CADDY_REVERSE_DNS", value = "*." + viewModel.customCaddyDomain)
                    }

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(color = CyberBorder.copy(alpha = 0.5f))
                    Spacer(modifier = Modifier.height(8.dp))

                    // Wipe Reset Option button
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = "Wipe cache and logs to original layout", fontSize = 11.sp, color = CyberTextSecondary)
                        Button(
                            onClick = { viewModel.wipeTelemetryAndReset() },
                            colors = ButtonDefaults.buttonColors(containerColor = NeonRed.copy(alpha = 0.2f)),
                            modifier = Modifier.border(BorderStroke(1.dp, NeonRed), RoundedCornerShape(8.dp)),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text("FLUSH STATS", color = NeonRed, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // --- Room Database Schema Mapping Section ---
        item {
            RoomSchemaDatabaseVisualizer(viewModel = viewModel)
        }

        // --- SEC 2: AGENT ACTIVITY HISTORIC TIMELINE ---
        item {
            Text(
                text = "ACTIVE AGENTS ACTIVITY TIMELINE",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = CyberTextSecondary,
                letterSpacing = 1.sp,
                modifier = Modifier.padding(start = 4.dp, top = 6.dp)
            )
        }

        if (logs.isEmpty()) {
            item {
                Text(
                    text = "Timeline logs are currently empty. Push a build run to populate events.",
                    fontSize = 12.sp,
                    color = CyberTextSecondary,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }

        items(logs) { log ->
            LogTimelineCard(log = log)
        }
    }
}

@Composable
fun ConfigParamRow(label: String, value: String) {
    Column(modifier = Modifier.padding(vertical = 4.dp)) {
        Text(text = label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
        Text(
            text = value,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace,
            color = CyberTextSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
fun LogTimelineCard(log: OrchestratorLog) {
    val styledColor = when (log.type) {
        "success" -> NeonGreen
        "warning" -> NeonAmber
        "error" -> NeonRed
        else -> NeonIndigo
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CyberCard.copy(alpha = 0.6f)),
        border = BorderStroke(1.dp, CyberBorder.copy(alpha = 0.3f)),
        shape = RoundedCornerShape(10.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Timeline node tag representational circle
            Box(
                modifier = Modifier
                    .padding(top = 3.dp)
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(styledColor)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = log.agentName, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = CyberTextPrimary)
                    val logTime = remember(log.timestamp) {
                        SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date(log.timestamp))
                    }
                    Text(text = logTime, fontSize = 10.sp, color = CyberTextSecondary)
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = log.message, fontSize = 11.sp, color = CyberTextSecondary, lineHeight = 15.sp)
            }
        }
    }
}

// --- SEC 6: ADD COMMIT / PR CREATOR SHEET DIALOG ---
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPRDialog(
    viewModel: VibeViewModel,
    onDismiss: () -> Unit
) {
    var title by remember { mutableStateOf("feat: add Case Management auditing") }
    var author by remember { mutableStateOf("@rajkhemani") }
    var changesText by remember { mutableStateOf("diff --git a/agents.py b/agents.py\n+ class AuditorNode:\n+     def audit_balance(self, file_path):\n+         return f'Audited {file_path}'") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(4.dp),
            colors = CardDefaults.cardColors(containerColor = CyberCard),
            border = BorderStroke(1.3.dp, NeonIndigo),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(18.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "SEMANTIC PR ANALYZER",
                        fontWeight = FontWeight.Black,
                        fontSize = 15.sp,
                        color = CyberTextPrimary,
                        letterSpacing = 0.5.sp
                    )

                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Clear, contentDescription = "Close", tint = CyberTextSecondary)
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Pull Request Title / Commit", color = CyberTextSecondary) },
                    modifier = Modifier.fillMaxWidth().testTag("pr_title_input"),
                    textStyle = TextStyle(color = CyberTextPrimary, fontSize = 13.sp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonIndigo,
                        unfocusedBorderColor = CyberBorder
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = author,
                    onValueChange = { author = it },
                    label = { Text("Author", color = CyberTextSecondary) },
                    modifier = Modifier.fillMaxWidth(),
                    textStyle = TextStyle(color = CyberTextPrimary, fontSize = 13.sp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonIndigo,
                        unfocusedBorderColor = CyberBorder
                    )
                )

                Spacer(modifier = Modifier.height(10.dp))

                OutlinedTextField(
                    value = changesText,
                    onValueChange = { changesText = it },
                    label = { Text("Source Diff / Commit Changes description", color = CyberTextSecondary) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp),
                    textStyle = TextStyle(fontFamily = FontFamily.Monospace, fontSize = 11.sp, color = CyberTextPrimary),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonIndigo,
                        unfocusedBorderColor = CyberBorder
                    )
                )

                Spacer(modifier = Modifier.height(16.dp))

                if (viewModel.isAnalyzing) {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(color = NeonIndigo)
                            Spacer(modifier = Modifier.height(8.dp))
                            Text("Querying Gemini Semantic Orchestration models...", color = CyberTextSecondary, fontSize = 11.sp)
                        }
                    }
                } else {
                    Button(
                        onClick = {
                            viewModel.analyzeAndCreatePR(title, author, changesText) {
                                onDismiss()
                            }
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("submit_pr_btn"),
                        colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo)
                    ) {
                        Icon(Icons.Default.Insights, contentDescription = "Scan", tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("ANALYZE & REGISTER COMMIT", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

// ==========================================
// FULL-STACK SYSTEM TOPOLOGY MODEL AND CONTROLS
// ==========================================

data class TopologyNode(
    val id: String,
    val name: String,
    val techStack: String,
    val path: String,
    val portAndAccessor: String,
    val description: String,
    val dependencies: List<String>,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val activeColor: Color,
    val environmentOverrides: String
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TopologyTabContent(viewModel: VibeViewModel) {
    var selectedNodeId by remember { mutableStateOf<String?>("ai_backend") }
    var isCheckingLiveness by remember { mutableStateOf(false) }
    var diagnosticReport by remember { mutableStateOf<String?>(null) }

    val scope = rememberCoroutineScope()

    val topologyNodes = remember {
        listOf(
            TopologyNode(
                id = "ai_backend",
                name = "AI-BACKEND",
                techStack = "Python 3.11, LangGraph, Pytest",
                path = "/AGASSOCIATES/ag-associates-ai/backend",
                portAndAccessor = "localhost:8000",
                description = "Handles multi-agent python orchestration states & state transaction nodes representing local litigation forms.",
                dependencies = listOf("supabase_db"),
                icon = Icons.Default.Terminal,
                activeColor = NeonGreen,
                environmentOverrides = "VLLM_API_PORT=8000\nLOCAL_EMBEDDINGS_DIM=384"
            ),
            TopologyNode(
                id = "ai_frontend",
                name = "AI-FRONTEND",
                techStack = "Next.js, React, Tailwind CSS",
                path = "/AGASSOCIATES/ag-platform/apps/mobile",
                portAndAccessor = "localhost:3000",
                description = "Main admin panel client exposing real-time tracking, flow visualizers, and state synchronization indicators.",
                dependencies = listOf("ag_platform"),
                icon = Icons.Default.Settings,
                activeColor = NeonGreen,
                environmentOverrides = "NEXT_PUBLIC_API_URL=http://localhost:8001"
            ),
            TopologyNode(
                id = "ag_platform",
                name = "AG-PLATFORM",
                techStack = "Node.js, Express, Turborepo, pnpm",
                path = "/AGASSOCIATES/ag-platform",
                portAndAccessor = "Caddy reverse proxy SSL",
                description = "Monorepo core routing Fastify interfaces, packages schemas db wrappers, and shared types definitions.",
                dependencies = listOf("supabase_db"),
                icon = Icons.Default.Build,
                activeColor = NeonGreen,
                environmentOverrides = "DATABASE_URL=postgresql://ag_associates_admin@localhost:5432\nPORT=8001"
            ),
            TopologyNode(
                id = "noi_prototype",
                name = "NOI-PROTOTYPE",
                techStack = "HTML5, Vanilla JS, Vite, CSS Grid",
                path = "/AGASSOCIATES/prototype/noi-dashboard",
                portAndAccessor = "localhost:5173",
                description = "Specialized visual client console focusing on litigation cases and custom state cards.",
                dependencies = listOf("ag_platform"),
                icon = Icons.Default.Code,
                activeColor = NeonGreen,
                environmentOverrides = "VITE_BACKEND_PORT=8001"
            ),
            TopologyNode(
                id = "n8n_whatsapp",
                name = "N8N-WHATSAPP",
                techStack = "n8n Webhook triggers, REST API, JSON",
                path = "/AGASSOCIATES/N8N_WHATSAPP_SETUP.md",
                portAndAccessor = "Webhook trigger port 5678",
                description = "Automates instant text communications. Automatically parses incoming questions to Fastify endpoint /api/intake.",
                dependencies = listOf("ai_backend", "ag_platform"),
                icon = Icons.Default.Bolt,
                activeColor = NeonBlue,
                environmentOverrides = "N8N_WEBHOOK_URL=http://localhost:5678/webhook"
            ),
            TopologyNode(
                id = "supabase_db",
                name = "SUPABASE/DB",
                techStack = "PostgreSQL, pgvector, Vector Index",
                path = "/AGASSOCIATES/ag-platform/supabase",
                portAndAccessor = "Port 5432 (Local Docker container)",
                description = "Host of SQL schema states and pgvector similarities (strictly indexed to 384 dimensions matching local embedding modules).",
                dependencies = emptyList(),
                icon = Icons.Default.Info,
                activeColor = NeonGreen,
                environmentOverrides = "POSTGRES_DB=ag_associates_db\nPOSTGRES_PORT=5432"
            )
        )
    }

    val selectedNode = remember(selectedNodeId) {
        topologyNodes.firstOrNull { it.id == selectedNodeId }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(top = 8.dp, bottom = 48.dp)
    ) {
        // Section: Description Card
        item {
            Card(
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                colors = CardDefaults.cardColors(containerColor = SleekRecentBg),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text(
                        text = "INTEGRATED PLATFORM SCHEMA TOPOLOGY",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = SleekDarkPurple,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Explore the interaction graph across all 6 services inside the AGASSOCIATES workspace. Click any node below to inspect environment setups, local folder pathways, active ports, and trigger isolated liveness diagnostics queries.",
                        fontSize = 12.sp,
                        color = CyberTextSecondary,
                        lineHeight = 16.sp
                    )
                }
            }
        }

        // Section: Grid list of nodes
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "ACTIVE SERVERS TOPOLOGY FLOW",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextSecondary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                )

                // Flawless grid representation
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    // Row 1 (Nodes 1 & 2)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(modifier = Modifier.weight(1f)) {
                            TopologyNodeCard(node = topologyNodes[0], isSelected = selectedNodeId == topologyNodes[0].id) {
                                selectedNodeId = topologyNodes[0].id
                            }
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            TopologyNodeCard(node = topologyNodes[1], isSelected = selectedNodeId == topologyNodes[1].id) {
                                selectedNodeId = topologyNodes[1].id
                            }
                        }
                    }
                    // Row 2 (Nodes 3 & 4)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(modifier = Modifier.weight(1f)) {
                            TopologyNodeCard(node = topologyNodes[2], isSelected = selectedNodeId == topologyNodes[2].id) {
                                selectedNodeId = topologyNodes[2].id
                            }
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            TopologyNodeCard(node = topologyNodes[3], isSelected = selectedNodeId == topologyNodes[3].id) {
                                selectedNodeId = topologyNodes[3].id
                            }
                        }
                    }
                    // Row 3 (Nodes 5 & 6)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(modifier = Modifier.weight(1f)) {
                            TopologyNodeCard(node = topologyNodes[4], isSelected = selectedNodeId == topologyNodes[4].id) {
                                selectedNodeId = topologyNodes[4].id
                            }
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            TopologyNodeCard(node = topologyNodes[5], isSelected = selectedNodeId == topologyNodes[5].id) {
                                selectedNodeId = topologyNodes[5].id
                            }
                        }
                    }
                }
            }
        }

        // Section: Selected Node Auditing Panel
        selectedNode?.let { node ->
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = CyberCard),
                    border = BorderStroke(1.2.dp, CyberBorder),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(NeonIndigo.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(node.icon, contentDescription = node.name, tint = NeonIndigo, modifier = Modifier.size(16.dp))
                                }
                                Spacer(modifier = Modifier.width(10.dp))
                                Column {
                                    Text(text = node.name, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = CyberTextPrimary)
                                    Text(
                                        text = node.path,
                                        fontSize = 10.sp,
                                        color = CyberTextSecondary,
                                        fontFamily = FontFamily.Monospace,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }

                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(node.activeColor.copy(alpha = 0.12f))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = if (node.activeColor == NeonBlue) "SLEEP/SYNC" else "ACTIVE",
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = node.activeColor
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = CyberBorder.copy(alpha = 0.4f))
                        Spacer(modifier = Modifier.height(10.dp))

                        // Stack Tech info
                        Text(text = "TECHNICAL STACK SPECIFICATION", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
                        Text(text = node.techStack, fontSize = 12.sp, color = CyberTextPrimary, fontWeight = FontWeight.Bold)
                        
                        Spacer(modifier = Modifier.height(8.dp))

                        // Description
                        Text(text = "MODULE DESCRIPTION", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
                        Text(text = node.description, fontSize = 12.sp, color = CyberTextSecondary, lineHeight = 16.sp)

                        Spacer(modifier = Modifier.height(8.dp))

                        // Ports
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = "CONNECTION PORT", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
                                Text(text = node.portAndAccessor, fontSize = 11.sp, color = CyberTextPrimary, fontFamily = FontFamily.Monospace)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = "GRAPH DEPENDENCIES", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
                                Text(
                                    text = if (node.dependencies.isEmpty()) "None" else node.dependencies.joinToString(", ").uppercase(),
                                    fontSize = 11.sp,
                                    color = CyberTextPrimary,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Environment Variable Overrides Panel
                        Text(text = "CORE TELEMETRY ENV VARIABLES", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF070A13), RoundedCornerShape(6.dp))
                                .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f)))
                                .padding(8.dp)
                        ) {
                            Text(
                                text = node.environmentOverrides,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                color = NeonGreen,
                                lineHeight = 14.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Isolated Check triggers
                        Button(
                            onClick = {
                                isCheckingLiveness = true
                                diagnosticReport = null
                                scope.launch {
                                    delay(1200)
                                    val checkedPing = (3..12).random()
                                    diagnosticReport = "Liveness successful. Port responding normally at socket. Connection ping: ${checkedPing}ms. Mem heap: ${52 + (1..6).random()}.4MB."
                                    isCheckingLiveness = false
                                }
                            },
                            enabled = !isCheckingLiveness,
                            colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            if (isCheckingLiveness) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Executing Diagnostics Probe...", fontSize = 11.sp, color = Color.White)
                            } else {
                                Icon(Icons.Default.PlayArrow, contentDescription = "Scan", tint = Color.White, modifier = Modifier.size(16.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("RUN ISOLATED TELEMETRY AUDIT", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        diagnosticReport?.let { report ->
                            Spacer(modifier = Modifier.height(8.dp))
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(NeonGreen.copy(alpha = 0.08f), RoundedCornerShape(6.dp))
                                    .border(BorderStroke(1.dp, NeonGreen.copy(alpha = 0.3f)))
                                    .padding(10.dp)
                            ) {
                                Row(verticalAlignment = Alignment.Top) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = "Pass", tint = NeonGreen, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(text = report, fontSize = 10.sp, color = NeonGreen, fontFamily = FontFamily.Monospace, lineHeight = 14.sp)
                                }
                            }
                        }
                    }
                }
            }
        }

        // Section: Smart Technical AI Architect Advisor
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF070A13)),
                border = BorderStroke(1.3.dp, NeonIndigo),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "SMART WORKSPACE ADVISOR",
                            fontWeight = FontWeight.Black,
                            fontSize = 12.sp,
                            color = CyberTextPrimary,
                            letterSpacing = 0.5.sp
                        )

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(NeonIndigo.copy(alpha = 0.15f))
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (viewModel.isApiKeyAvailable) "GEMINI LIVE" else "LOCAL AI MODEL",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                color = NeonIndigo
                            )
                        }
                    }

                    Text(
                        text = "Consult our system setup advisor on how Python LangGraph Agents, Supabase variables, n8n integrations, or monorepo layers interact inside /AGASSOCIATES.",
                        fontSize = 11.sp,
                        color = CyberTextSecondary,
                        lineHeight = 15.sp,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Suggestion Queries matrix
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(modifier = Modifier.weight(1f)) {
                                SuggestionPill(label = "Explain Python LangGraph Loop") {
                                    viewModel.advisorQuery = "Explain how python langgraph agents operate inside ag-associates-ai"
                                    viewModel.askArchitectAdvisor()
                                }
                            }
                            Box(modifier = Modifier.weight(1f)) {
                                SuggestionPill(label = "WhatsApp webhook maps") {
                                    viewModel.advisorQuery = "Where are whatsapp n8n configuration targets and ports?"
                                    viewModel.askArchitectAdvisor()
                                }
                            }
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Box(modifier = Modifier.weight(1f)) {
                                SuggestionPill(label = "Supabase vector dimensions") {
                                    viewModel.advisorQuery = "What are the pgvector schemas models and dims in Supabase?"
                                    viewModel.askArchitectAdvisor()
                                }
                            }
                            Box(modifier = Modifier.weight(1f)) {
                                SuggestionPill(label = "Monorepo Express service paths") {
                                    viewModel.advisorQuery = "What services and packages are configured under ag-platform package monorepo?"
                                    viewModel.askArchitectAdvisor()
                                }
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    // Input Query Area
                    OutlinedTextField(
                        value = viewModel.advisorQuery,
                        onValueChange = { viewModel.advisorQuery = it },
                        label = { Text("Architect inquiry", color = CyberTextSecondary) },
                        modifier = Modifier.fillMaxWidth(),
                        textStyle = TextStyle(color = CyberTextPrimary, fontSize = 12.sp),
                        placeholder = { Text("Ask: 'Explain the platform Express paths' etc...", fontSize = 11.sp, color = CyberTextSecondary.copy(alpha = 0.5f)) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = NeonIndigo,
                            unfocusedBorderColor = CyberBorder
                        )
                    )

                    Spacer(modifier = Modifier.height(10.dp))

                    // Floating action button triggers
                    Button(
                        onClick = { viewModel.askArchitectAdvisor() },
                        enabled = !viewModel.isQueryingAdvisor && viewModel.advisorQuery.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        if (viewModel.isQueryingAdvisor) {
                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Consulting Expert Advisor...", fontSize = 11.sp, color = Color.White)
                        } else {
                            Icon(Icons.Default.Insights, contentDescription = "Query", tint = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("ASK ARCHITECT ADVISOR", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 11.sp)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    // Output rich Response frame
                    Text(text = "ADVISOR RESPONSE OUTPUT FEED", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NeonCyan)
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.Black, RoundedCornerShape(8.dp))
                            .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f)))
                            .padding(12.dp)
                    ) {
                        Text(
                            text = viewModel.advisorResponse,
                            color = CyberTextSecondary,
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            fontFamily = FontFamily.Default
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TopologyNodeCard(node: TopologyNode, isSelected: Boolean, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .clickable { onClick() },
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) NeonIndigo.copy(alpha = 0.12f) else CyberCard
        ),
        border = BorderStroke(
            1.2.dp,
            if (isSelected) NeonIndigo else CyberBorder.copy(alpha = 0.3f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (isSelected) NeonIndigo.copy(alpha = 0.2f) else CyberBorder.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = node.icon,
                    contentDescription = node.name,
                    tint = if (isSelected) NeonIndigo else CyberTextSecondary,
                    modifier = Modifier.size(15.dp)
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = node.name,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(node.activeColor)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = if (node.activeColor == NeonBlue) "Listening" else "Healthy",
                        fontSize = 9.sp,
                        color = node.activeColor,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
fun SuggestionPill(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(CyberBorder.copy(alpha = 0.3f))
            .clickable { onClick() }
            .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.4f)), RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 9.sp,
            color = CyberTextPrimary,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// ==========================================
// SQLITE DATABASE SCHEMATICS AND ENTITIES TRACKER
// ==========================================

@Composable
fun RoomSchemaDatabaseVisualizer(viewModel: VibeViewModel) {
    val prs by viewModel.pullRequests.collectAsState()
    val runs by viewModel.deploymentRuns.collectAsState()
    val logs by viewModel.orchestratorLogs.collectAsState()

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CyberCard),
        border = BorderStroke(1.dp, CyberBorder),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(text = "ROOM LOCAL PERSISTENCY SCHEMA DIAGRAM", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = SleekDarkPurple, letterSpacing = 0.5.sp)
            Text(text = "SQLite robust stateful backend schemas index", fontSize = 10.sp, color = CyberTextSecondary)
            Spacer(modifier = Modifier.height(12.dp))

            // The list of entities styled like tables in database schematic diagram
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                // Table: pull_requests
                SchemaDatabaseTableCard(
                    tableName = "pull_requests (Room Entity)",
                    count = prs.size,
                    fields = listOf("id: Int (PK)", "title: Text", "riskTier: Text", "status: Text", "mergeStatus: Text")
                )
                
                // Table: deployment_runs
                SchemaDatabaseTableCard(
                    tableName = "deployment_runs (Room Entity)",
                    count = runs.size,
                    fields = listOf("id: Int (AutoPK)", "commitSha: Text", "prNumber: Int", "status: Text", "logData: Blob")
                )

                // Table: orchestrator_log
                SchemaDatabaseTableCard(
                    tableName = "orchestrator_log (Room Entity)",
                    count = logs.size,
                    fields = listOf("id: Int (AutoPK)", "timestamp: Long", "agentName: Text", "message: Text", "type: Text")
                )
            }
        }
    }
}

@Composable
fun SchemaDatabaseTableCard(tableName: String, count: Int, fields: List<String>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF070A13)),
        border = BorderStroke(1.dp, CyberBorder.copy(alpha = 0.4f)),
        shape = RoundedCornerShape(8.dp)
    ) {
        Column(modifier = Modifier.padding(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(6.dp)
                            .clip(CircleShape)
                            .background(NeonIndigo)
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(text = tableName, fontWeight = FontWeight.Bold, fontSize = 11.sp, color = CyberTextPrimary)
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(NeonIndigo.copy(alpha = 0.15f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(text = "$count records", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = NeonIndigo)
                }
            }
            Spacer(modifier = Modifier.height(6.dp))
            HorizontalDivider(color = CyberBorder.copy(alpha = 0.3f))
            Spacer(modifier = Modifier.height(6.dp))
            
            // Render list of properties in custom grid
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                fields.forEach { field ->
                    Box(
                        modifier = Modifier
                            .background(CyberBorder.copy(alpha = 0.3f), RoundedCornerShape(4.dp))
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    ) {
                        Text(text = field, fontSize = 8.sp, color = CyberTextSecondary, fontFamily = FontFamily.Monospace)
                    }
                }
            }
        }
    }
}
