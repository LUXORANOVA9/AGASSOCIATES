package com.example.ui

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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import com.example.data.*
import com.example.ui.theme.*
import com.example.ui.viewmodel.VibeViewModel
import kotlinx.coroutines.launch



/**
 * PHASE 1: Authentication Portal Screen.
 * Allows user-friendly simulation of logging in as Aditya Gade (Founder)
 * or operations managers, in full compliance with the AGOS specification.
 */
@Composable
fun AgosAuthPortal(viewModel: VibeViewModel) {
    var emailInput by remember { mutableStateOf("") }
    var nameInput by remember { mutableStateOf("") }
    var isRegistering by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(Color(0xFF020617), CyberBg)
                )
            )
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 480.dp),
            colors = CardDefaults.cardColors(containerColor = SleekContainer),
            border = BorderStroke(1.2.dp, CyberBorder),
            shape = RoundedCornerShape(24.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header Display Icon
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(NeonIndigo.copy(alpha = 0.15f))
                        .border(BorderStroke(1.5.dp, NeonIndigo), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Lock,
                        contentDescription = "Lock Logo",
                        tint = NeonIndigo,
                        modifier = Modifier.size(32.dp)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "AGOS OPERATIONS",
                    style = MaterialTheme.typography.headlineSmall,
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 1.2.sp
                )
                Text(
                    text = "Your Digital Workforce for Legal & Banking Ops",
                    style = MaterialTheme.typography.bodyMedium,
                    color = CyberTextSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp)
                )

                Spacer(modifier = Modifier.height(28.dp))

                // Predefined Roles Autofill Buttons to make testing extremely seamless
                Text(
                    text = "SELECT WORKSPACE IDENTITY QUICKFILL",
                    fontSize = 10.sp,
                    color = NeonCyan,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.8.sp,
                    modifier = Modifier.align(Alignment.Start)
                )

                Spacer(modifier = Modifier.height(8.dp))

                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    AutofillRoleRow(
                        name = "Aditya Gade",
                        role = "Founder & Admin",
                        icon = Icons.Default.SupervisorAccount,
                        onClick = {
                            nameInput = "Aditya Gade"
                            emailInput = "aditya.gade@ag.associates"
                        }
                    )
                    AutofillRoleRow(
                        name = "Elias G",
                        role = "Legal Executive",
                        icon = Icons.Default.Gavel,
                        onClick = {
                            nameInput = "Elias G"
                            emailInput = "elias@ag.associates"
                        }
                    )
                    AutofillRoleRow(
                        name = "Rajesh Kumar",
                        role = "Operations Manager",
                        icon = Icons.Default.Work,
                        onClick = {
                            nameInput = "Rajesh Kumar"
                            emailInput = "rajesh@ag.associates"
                        }
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Divider(color = CyberBorder, thickness = 1.dp)

                Spacer(modifier = Modifier.height(20.dp))

                // Custom Credentials Inputs
                OutlinedTextField(
                    value = nameInput,
                    onValueChange = { nameInput = it },
                    label = { Text("Enter Full Name", color = CyberTextSecondary) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonIndigo,
                        unfocusedBorderColor = CyberBorder,
                        focusedLabelColor = NeonIndigo,
                        cursorColor = NeonIndigo,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("username_input"),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = emailInput,
                    onValueChange = { emailInput = it },
                    label = { Text("Corporate Email Address", color = CyberTextSecondary) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = NeonIndigo,
                        unfocusedBorderColor = CyberBorder,
                        focusedLabelColor = NeonIndigo,
                        cursorColor = NeonIndigo,
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Submit Button
                Button(
                    onClick = {
                        if (nameInput.isNotBlank() && emailInput.isNotBlank()) {
                            viewModel.loginUser(emailInput, nameInput)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp)
                        .testTag("login_button"),
                    colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                    enabled = nameInput.isNotBlank() && emailInput.isNotBlank(),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.VpnKey, contentDescription = "Keys", tint = Color.White)
                    Spacer(modifier = Modifier.width(10.dp))
                    Text(
                        text = if (isRegistering) "PROVISION DIGITAL WORKSPACE" else "AUTHENTICATE AGOS PORTAL",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "Locked via secure 256-bit encryption. System sync active.",
                    fontSize = 10.sp,
                    color = CyberTextSecondary,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
fun AutofillRoleRow(name: String, role: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(CyberBg.copy(alpha = 0.6f))
            .border(BorderStroke(1.dp, CyberBorder), RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(NeonIndigo.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(imageVector = icon, contentDescription = null, tint = NeonIndigo, modifier = Modifier.size(18.dp))
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(text = name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text(text = role, color = CyberTextSecondary, fontSize = 10.sp)
        }
        Icon(imageVector = Icons.Default.ArrowForward, contentDescription = null, tint = NeonCyan, modifier = Modifier.size(16.dp))
    }
}


/**
 * AGOS Central Dashboard Command Console.
 * Implements stats, server telemetry states, active workflow trigger points,
 * and live workforce scrolling outputs.
 */
@Composable
fun AgosDashboardConsole(viewModel: VibeViewModel) {
    val clients = viewModel.agosClients
    val cases = viewModel.agosCases
    val tasks = viewModel.agosTasks
    val notifications = viewModel.agosNotifications
    val activeUser = viewModel.currentUserName
    
    var showAiTriggerDialog by remember { mutableStateOf(false) }
    var selectedCaseForAgentRun by remember { mutableStateOf<AgosCase?>(null) }
    var selectedAgentForRun by remember { mutableStateOf<AIEmployee?>(null) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        contentPadding = PaddingValues(top = 12.dp, bottom = 28.dp)
    ) {
        // Welcoming User Banner Row
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SleekContainer),
                border = BorderStroke(1.dp, NeonIndigo.copy(alpha = 0.3f)),
                shape = RoundedCornerShape(16.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(NeonCyan.copy(alpha = 0.12f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Person, contentDescription = "User", tint = NeonCyan)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "Welcome Back, $activeUser", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
                        Text(text = "Identity Session: ${viewModel.currentUserRole} • Status: Synchronized", color = CyberTextSecondary, fontSize = 11.sp)
                    }
                    Button(
                        onClick = { viewModel.logoutUser() },
                        colors = ButtonDefaults.buttonColors(containerColor = NeonRed.copy(alpha = 0.15f), contentColor = NeonRed),
                        modifier = Modifier.height(32.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Sign Out", fontSize = 10.sp)
                    }
                }
            }
        }

        // STATS BAR - High-Fidelity 2-Column Grid of Core AGOS Performance Widgets
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "AG OPERATIONAL METRICS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextSecondary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        StatsWidget(
                            title = "ACTIVE CASES",
                            value = cases.filter { it.status != "Completed" }.size.toString(),
                            subtitle = "Mortgage & NOIs",
                            color = NeonCyan,
                            icon = Icons.Default.FolderOpen
                        )
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        StatsWidget(
                            title = "PENDING TASKS",
                            value = tasks.filter { it.status != "Completed" }.size.toString(),
                            subtitle = "Assigned to staff/AIs",
                            color = NeonIndigo,
                            icon = Icons.Default.AssignmentLate
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        StatsWidget(
                            title = "RISK ALERT FEED",
                            value = notifications.size.toString(),
                            subtitle = "SLA Alerts Discovered",
                            color = NeonAmber,
                            icon = Icons.Default.Warning
                        )
                    }
                    Box(modifier = Modifier.weight(1f)) {
                        StatsWidget(
                            title = "ESTIMATED REVENUE",
                            value = "₹1,45,200",
                            subtitle = "Completed operations",
                            color = NeonGreen,
                            icon = Icons.Default.MonetizationOn
                        )
                    }
                }
            }
        }

        // ACTIVE PIPELINES SKELETON DIAGNOSTICS - Preserved cluster checkpoints
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "ACTIVE CONTAINER PLATFORMS",
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
                            PipelineUnit(name = "AI-BACKEND", status = "ONLINE", color = NeonGreen)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineUnit(name = "AI-FRONTEND", status = "ONLINE", color = NeonGreen)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineUnit(name = "AG-PLATFORM", status = "ONLINE", color = NeonGreen)
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineUnit(name = "NOI-PROTOTYPE", status = "ONLINE", color = NeonGreen)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineUnit(name = "N8N-WHATSAPP", status = "SLEEP", color = NeonBlue)
                        }
                        Box(modifier = Modifier.weight(1f)) {
                            PipelineUnit(name = "SUPABASE/DB", status = "ONLINE", color = NeonGreen)
                        }
                    }
                }
            }
        }

        // TRIGGER RUN MATRIX: Real Digital Workforce triggers
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SleekContainer),
                border = BorderStroke(1.dp, CyberBorder),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        text = "TRIGGER WORKFORCE WORKFLOW RUN",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = NeonCyan,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Choose an active case file, pick an AI worker node, and instantly delegate computational tasks.",
                        color = CyberTextSecondary,
                        fontSize = 11.sp
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = {
                                if (cases.isNotEmpty()) {
                                    selectedCaseForAgentRun = cases.first()
                                    selectedAgentForRun = viewModel.agosAIEmployees.firstOrNull { it.id == "document" }
                                    showAiTriggerDialog = true
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp),
                            enabled = !viewModel.isAIWorkflowActive
                        ) {
                            Icon(Icons.Default.PlayArrow, contentDescription = "Run", tint = Color.White)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("RUN AUTOMATION DISPATCH", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        // DOCKING CONSOLE SCROLLER TERMINAL - Display Live Workforce outputs
        item {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "DIGITAL WORKFORCE SIMULATED TELEMETRY FEED",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = CyberTextSecondary,
                    letterSpacing = 1.sp,
                    modifier = Modifier.padding(start = 4.dp, bottom = 6.dp)
                )

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF070B19)),
                    border = BorderStroke(1.2.dp, if (viewModel.isAIWorkflowActive) NeonCyan else CyberBorder),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Box(modifier = Modifier.fillMaxSize().padding(12.dp)) {
                        LazyColumn(modifier = Modifier.fillMaxSize()) {
                            items(viewModel.terminalLines) { line ->
                                Text(
                                    text = line,
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 10.5.sp,
                                    color = when {
                                        line.contains("Completed") || line.contains("✓") || line.contains("success") -> NeonGreen
                                        line.contains("hazard") || line.contains("anomaly") || line.contains("Error") -> NeonRed
                                        line.contains("Intake") || line.contains("AI") -> NeonCyan
                                        else -> Color(0xFFE2E8F0)
                                    },
                                    lineHeight = 14.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAiTriggerDialog && selectedCaseForAgentRun != null) {
        Dialog(onDismissRequest = { showAiTriggerDialog = false }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = SleekContainer),
                border = BorderStroke(1.5.dp, CyberBorder),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(24.dp)
                        .fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Orchestrate Digital Employee",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))

                    Text(text = "Target Case Folder:", color = CyberTextSecondary, fontSize = 11.sp, modifier = Modifier.align(Alignment.Start))
                    Spacer(modifier = Modifier.height(4.dp))
                    var isCaseExpanded by remember { mutableStateOf(false) }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(CyberBg)
                            .border(BorderStroke(1.dp, CyberBorder), RoundedCornerShape(8.dp))
                            .clickable { isCaseExpanded = !isCaseExpanded }
                            .padding(12.dp)
                    ) {
                        Text(
                            text = "${selectedCaseForAgentRun?.caseNumber} - ${selectedCaseForAgentRun?.clientName} (${selectedCaseForAgentRun?.serviceType})",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        DropdownMenu(
                            expanded = isCaseExpanded,
                            onDismissRequest = { isCaseExpanded = false },
                            modifier = Modifier.background(SleekContainer)
                        ) {
                            cases.forEach { c ->
                                DropdownMenuItem(
                                    text = { Text("${c.caseNumber} - ${c.clientName}", color = Color.White) },
                                    onClick = {
                                        selectedCaseForAgentRun = c
                                        isCaseExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Text(text = "Assign Virtual Agent:", color = CyberTextSecondary, fontSize = 11.sp, modifier = Modifier.align(Alignment.Start))
                    Spacer(modifier = Modifier.height(4.dp))
                    var isAgentExpanded by remember { mutableStateOf(false) }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(CyberBg)
                            .border(BorderStroke(1.dp, CyberBorder), RoundedCornerShape(8.dp))
                            .clickable { isAgentExpanded = !isAgentExpanded }
                            .padding(12.dp)
                    ) {
                        Text(
                            text = selectedAgentForRun?.name ?: "Pick Worker",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        DropdownMenu(
                            expanded = isAgentExpanded,
                            onDismissRequest = { isAgentExpanded = false },
                            modifier = Modifier.background(SleekContainer)
                        ) {
                            viewModel.agosAIEmployees.forEach { emp ->
                                DropdownMenuItem(
                                    text = { Text(emp.name, color = Color.White) },
                                    onClick = {
                                        selectedAgentForRun = emp
                                        isAgentExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showAiTriggerDialog = false },
                            modifier = Modifier.weight(1f),
                            border = BorderStroke(1.dp, CyberBorder),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = CyberTextSecondary)
                        ) {
                            Text("Cancel")
                        }
                        Button(
                            onClick = {
                                showAiTriggerDialog = false
                                val agent = selectedAgentForRun
                                val cItem = selectedCaseForAgentRun
                                if (agent != null && cItem != null) {
                                    viewModel.triggerAiEmployeeWorkflow(agent.id, cItem.id)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = NeonCyan),
                            modifier = Modifier.weight(1.3f)
                        ) {
                            Text("DISPATCH RUN")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StatsWidget(title: String, value: String, subtitle: String, color: Color, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = SleekContainer),
        border = BorderStroke(1.dp, CyberBorder),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = TextStyle(
                        color = CyberTextSecondary,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                )
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = color,
                    modifier = Modifier.size(16.dp)
                )
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = value,
                color = Color.White,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subtitle,
                color = CyberTextSecondary,
                fontSize = 10.sp
            )
        }
    }
}

@Composable
fun PipelineUnit(name: String, status: String, color: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(SleekContainer)
            .border(BorderStroke(1.dp, CyberBorder), RoundedCornerShape(8.dp))
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = name, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(color)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(text = status, color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold)
        }
    }
}


/**
 * AGOS Virtual AI Employee Board.
 * Arranged in a beautiful visual horizontal Kanban layout with column categories:
 * "Waiting", "Working", "Review", "Completed".
 */
@Composable
fun AgosAiTeamBoard(viewModel: VibeViewModel) {
    val employees = viewModel.agosAIEmployees
    val cases = viewModel.agosCases
    var showTriggerRunDialog by remember { mutableStateOf(false) }
    var selectedEmployeeForTrigger by remember { mutableStateOf<AIEmployee?>(null) }
    var targetCaseForTrigger by remember { mutableStateOf<AgosCase?>(null) }

    LaunchedEffect(cases) {
        if (targetCaseForTrigger == null && cases.isNotEmpty()) {
            targetCaseForTrigger = cases.first()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "VIRTUAL CO-WORKFORCE PIPELINE BOARD",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = CyberTextSecondary,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(start = 4.dp, bottom = 12.dp)
        )

        // Kanban columns selector
        val columns = listOf("Waiting", "Working", "Review", "Completed")

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .weight(1f),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            items(columns) { col ->
                val workersInCol = employees.filter { it.column == col }
                
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SleekContainer.copy(alpha = 0.5f)),
                    border = BorderStroke(1.2.dp, when(col) {
                        "Waiting" -> CyberBorder
                        "Working" -> NeonIndigo.copy(alpha = 0.5f)
                        "Review" -> NeonAmber.copy(alpha = 0.5f)
                        else -> NeonGreen.copy(alpha = 0.5f)
                    }),
                    shape = RoundedCornerShape(16.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${col.uppercase()} (${workersInCol.size})",
                                color = when(col) {
                                    "Waiting" -> CyberTextSecondary
                                    "Working" -> NeonIndigo
                                    "Review" -> NeonAmber
                                    else -> NeonGreen
                                },
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 0.5.sp
                            )
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(when(col) {
                                        "Waiting" -> CyberTextSecondary
                                        "Working" -> NeonIndigo
                                        "Review" -> NeonAmber
                                        else -> NeonGreen
                                    })
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        if (workersInCol.isEmpty()) {
                            Text(
                                text = "No active employees in this stage",
                                color = CyberTextSecondary,
                                fontSize = 11.sp,
                                modifier = Modifier.padding(vertical = 12.dp)
                            )
                        } else {
                            workersInCol.forEach { emp ->
                                AIEmployeeKanbanCard(
                                    emp = emp,
                                    onTriggerClicked = {
                                        selectedEmployeeForTrigger = emp
                                        showTriggerRunDialog = true
                                    }
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                        }
                    }
                }
            }
        }
    }

    if (showTriggerRunDialog && selectedEmployeeForTrigger != null) {
        Dialog(onDismissRequest = { showTriggerRunDialog = false }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = SleekContainer),
                border = BorderStroke(1.2.dp, CyberBorder),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(24.dp)
                        .fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Delegate Task: ${selectedEmployeeForTrigger?.name}",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Empower this digital employee. Pick a case below files list to process:",
                        fontSize = 11.sp,
                        color = CyberTextSecondary,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // Selection dropdown
                    var isCaseExpanded by remember { mutableStateOf(false) }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(CyberBg)
                            .border(BorderStroke(1.dp, CyberBorder), RoundedCornerShape(8.dp))
                            .clickable { isCaseExpanded = !isCaseExpanded }
                            .padding(12.dp)
                    ) {
                        Text(
                            text = targetCaseForTrigger?.caseNumber ?: "Pick Case File",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                        DropdownMenu(
                            expanded = isCaseExpanded,
                            onDismissRequest = { isCaseExpanded = false },
                            modifier = Modifier.background(SleekContainer)
                        ) {
                            cases.forEach { c ->
                                DropdownMenuItem(
                                    text = { Text("${c.caseNumber} - ${c.clientName}", color = Color.White) },
                                    onClick = {
                                        targetCaseForTrigger = c
                                        isCaseExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showTriggerRunDialog = false },
                            modifier = Modifier.weight(1f),
                            border = BorderStroke(1.dp, CyberBorder),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = CyberTextSecondary)
                        ) {
                            Text("Discard")
                        }
                        Button(
                            onClick = {
                                showTriggerRunDialog = false
                                val emp = selectedEmployeeForTrigger
                                val cItem = targetCaseForTrigger
                                if (emp != null && cItem != null) {
                                    viewModel.triggerAiEmployeeWorkflow(emp.id, cItem.id)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                            modifier = Modifier.weight(1.3f)
                        ) {
                            Text("TRIGGER AI ENGINE")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun AIEmployeeKanbanCard(emp: AIEmployee, onTriggerClicked: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CyberBg),
        border = BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f)),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(NeonIndigo.copy(alpha = 0.15f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = when(emp.iconName) {
                            "Work" -> Icons.Default.Work
                            "FilePresent" -> Icons.Default.FilePresent
                            "FactCheck" -> Icons.Default.FactCheck
                            "NotificationsActive" -> Icons.Default.NotificationsActive
                            "SupervisorAccount" -> Icons.Default.SupervisorAccount
                            "Analytics" -> Icons.Default.Analytics
                            else -> Icons.Default.Person
                        },
                        contentDescription = "Employee icon",
                        tint = NeonIndigo,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = emp.name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    Text(text = emp.purpose, color = CyberTextSecondary, fontSize = 10.sp)
                }
                
                // Trigger button
                IconButton(
                    onClick = onTriggerClicked,
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(NeonCyan.copy(alpha = 0.12f))
                ) {
                    Icon(Icons.Default.FlashOn, contentDescription = "Trigger Workflow", tint = NeonCyan, modifier = Modifier.size(16.dp))
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Progress reporting
            if (emp.column == "Working") {
                LinearProgressIndicator(
                    progress = { emp.progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(3.dp)
                        .clip(RoundedCornerShape(2.dp)),
                    color = NeonIndigo,
                    trackColor = CyberBorder.copy(alpha = 0.3f)
                )
                Spacer(modifier = Modifier.height(6.dp))
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Current: " + emp.currentTask,
                    color = CyberTextSecondary,
                    fontSize = 10.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "ETA: " + emp.estimatedCompletion,
                    color = NeonAmber,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Handover status: " + emp.handoverStatus,
                color = NeonGreen,
                fontSize = 9.sp,
                fontFamily = FontFamily.Monospace
            )
        }
    }
}


/**
 * AGOS Primary Workspaces Hub.
 * Shows Client Onboarding/Profiles and Case Folders with Checklist, Documents,
 * and Counsel reviews.
 */
@Composable
fun AgosWorkspacesCenter(viewModel: VibeViewModel) {
    var workspaceTab by remember { mutableStateOf(0) } // 0 = Clients Directory, 1 = Case Vault Folder
    
    // Clients state
    val clients = viewModel.agosClients
    var showAddClientDialog by remember { mutableStateOf(false) }

    // Case selection state
    val cases = viewModel.agosCases
    var selectedCase by remember { mutableStateOf<AgosCase?>(null) }

    LaunchedEffect(cases) {
        if (selectedCase == null && cases.isNotEmpty()) {
            selectedCase = cases.first()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Dual Sub-Tab Controller Menu
        TabRow(
            selectedTabIndex = workspaceTab,
            containerColor = SleekContainer,
            contentColor = NeonIndigo,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier.tabIndicatorOffset(tabPositions[workspaceTab]),
                    color = NeonIndigo
                )
            }
        ) {
            Tab(
                selected = workspaceTab == 0,
                onClick = { workspaceTab = 0 },
                text = { Text("Clients Onboarding Center", color = if (workspaceTab == 0) Color.White else CyberTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            )
            Tab(
                selected = workspaceTab == 1,
                onClick = { workspaceTab = 1 },
                text = { Text("Case Vault Folders", color = if (workspaceTab == 1) Color.White else CyberTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            )
        }

        Box(modifier = Modifier.fillMaxSize().weight(1f)) {
            if (workspaceTab == 0) {
                // CLIENTS DIRECTORY SCREEN
                Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "CLIENT COMPILATION DIRECTORY (${clients.size})",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = CyberTextSecondary,
                            letterSpacing = 0.5.sp
                        )
                        Button(
                            onClick = { showAddClientDialog = true },
                            colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                            modifier = Modifier.height(34.dp).testTag("onboard_client_fab"),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.Add, contentDescription = "Add Client", tint = Color.White, modifier = Modifier.size(16.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Onboard New Client", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(clients) { c ->
                            ClientProfileCard(client = c)
                        }
                    }
                }
            } else {
                // CASE VAULT SCREEN
                Row(modifier = Modifier.fillMaxSize()) {
                    // Left Column - Side Case Files List Selector
                    Column(
                        modifier = Modifier
                            .weight(0.42f)
                            .fillMaxHeight()
                            .background(CyberBg.copy(alpha = 0.4f))
                            .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f)))
                            .padding(8.dp)
                    ) {
                        Text(
                            text = "CASE FILE IDS",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = CyberTextSecondary,
                            letterSpacing = 0.5.sp,
                            modifier = Modifier.padding(bottom = 8.dp, start = 4.dp)
                        )
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            verticalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            items(cases) { c ->
                                val isSelected = selectedCase?.id == c.id
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (isSelected) NeonIndigo.copy(alpha = 0.15f) else Color.Transparent)
                                        .border(BorderStroke(1.dp, if (isSelected) NeonIndigo else CyberBorder.copy(alpha = 0.3f)), RoundedCornerShape(8.dp))
                                        .clickable { selectedCase = c }
                                        .padding(10.dp)
                                ) {
                                    Column {
                                        Text(
                                            text = c.caseNumber,
                                            fontWeight = FontWeight.Bold,
                                            color = if (isSelected) NeonCyan else Color.White,
                                            fontSize = 12.sp
                                        )
                                        Text(
                                            text = c.clientName,
                                            color = CyberTextSecondary,
                                            fontSize = 9.5.sp,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // Right Column - Selected Case Workspace Panel with multiple Sub-Tabs
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .padding(12.dp)
                    ) {
                        if (selectedCase == null) {
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Text("Select a Case from the left index", color = CyberTextSecondary, fontSize = 12.sp)
                            }
                        } else {
                            CaseWorkspaceDetailsPanel(viewModel = viewModel, caseItem = selectedCase!!)
                        }
                    }
                }
            }
        }
    }

    if (showAddClientDialog) {
        Dialog(onDismissRequest = { showAddClientDialog = false }) {
            var inputName by remember { mutableStateOf("") }
            var inputCompany by remember { mutableStateOf("") }
            var inputEmail by remember { mutableStateOf("") }
            var inputPhone by remember { mutableStateOf("") }
            var inputAddress by remember { mutableStateOf("") }
            var inputCity by remember { mutableStateOf("") }
            var inputState by remember { mutableStateOf("") }

            Card(
                colors = CardDefaults.cardColors(containerColor = SleekContainer),
                border = BorderStroke(1.5.dp, CyberBorder),
                shape = RoundedCornerShape(16.dp)
            ) {
                Column(
                    modifier = Modifier
                        .padding(20.dp)
                        .fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "ONBOARD NOVEL CLIENT PROFILE",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = NeonCyan,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(14.dp))

                    OutlinedTextField(
                        value = inputName,
                        onValueChange = { inputName = it },
                        label = { Text("Borrower Name", color = CyberTextSecondary, fontSize = 11.sp) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonIndigo, unfocusedBorderColor = CyberBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                        modifier = Modifier.fillMaxWidth().testTag("client_name_input"),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = inputCompany,
                        onValueChange = { inputCompany = it },
                        label = { Text("Company / Lending Bank Partner", color = CyberTextSecondary, fontSize = 11.sp) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonIndigo, unfocusedBorderColor = CyberBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = inputEmail,
                        onValueChange = { inputEmail = it },
                        label = { Text("Contact Email", color = CyberTextSecondary, fontSize = 11.sp) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonIndigo, unfocusedBorderColor = CyberBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = inputPhone,
                        onValueChange = { inputPhone = it },
                        label = { Text("Contact Telephone", color = CyberTextSecondary, fontSize = 11.sp) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonIndigo, unfocusedBorderColor = CyberBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = inputAddress,
                        onValueChange = { inputAddress = it },
                        label = { Text("Asset Office Street", color = CyberTextSecondary, fontSize = 11.sp) },
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonIndigo, unfocusedBorderColor = CyberBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showAddClientDialog = false },
                            modifier = Modifier.weight(1f),
                            border = BorderStroke(1.dp, CyberBorder),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = CyberTextSecondary)
                        ) {
                            Text("Dismiss", fontSize = 11.sp)
                        }
                        Button(
                            onClick = {
                                if (inputName.isNotBlank() && inputEmail.isNotBlank()) {
                                    viewModel.addClient(inputName, inputCompany, inputPhone, inputEmail, inputAddress, inputCity, inputState)
                                    showAddClientDialog = false
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                            modifier = Modifier.weight(1.3f),
                            enabled = inputName.isNotBlank() && inputEmail.isNotBlank()
                        ) {
                            Text("SAVE PROFILE", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ClientProfileCard(client: AgosClient) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = SleekContainer),
        border = BorderStroke(1.dp, CyberBorder),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(NeonIndigo.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.Business, contentDescription = "Bank logo", tint = NeonIndigo, modifier = Modifier.size(20.dp))
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = client.clientName, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                    Text(text = "Entity: " + client.companyName, color = CyberTextSecondary, fontSize = 11.sp)
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            Divider(color = CyberBorder.copy(alpha = 0.4f), thickness = 1.dp)
            Spacer(modifier = Modifier.height(12.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Column {
                    Text(text = "TELEPHONE", color = CyberTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(text = client.phone, color = Color.White, fontSize = 11.sp)
                }
                Column {
                    Text(text = "EMAIL PATHWAY", color = CyberTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(text = client.email, color = Color.White, fontSize = 11.sp)
                }
            }

            Spacer(modifier = Modifier.height(10.dp))
            Row(modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text(text = "PRIMARY OFFICE LOCATION", color = CyberTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(text = client.address, color = Color.White, fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
fun CaseWorkspaceDetailsPanel(viewModel: VibeViewModel, caseItem: AgosCase) {
    var detailsTab by remember { mutableStateOf(0) } // 0 = Tasks/Checklist, 1 = Document Vault, 2 = Counsel Approval, 3 = AI Checks

    // Card Header details
    Text(
        text = "CASE WORKSPACE",
        color = NeonCyan,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.8.sp
    )
    Spacer(modifier = Modifier.height(4.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(text = "Case #${caseItem.caseNumber}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.ExtraBold)
            Text(text = "${caseItem.serviceType} • Owner: ${caseItem.assignedTo}", color = CyberTextSecondary, fontSize = 10.sp)
        }
        
        // Priority Badge glow design
        Box(
            modifier = Modifier
                .background(
                    when(caseItem.priority) {
                        "Critical" -> NeonRed.copy(alpha = 0.15f)
                        "High" -> NeonAmber.copy(alpha = 0.15f)
                        "Medium" -> NeonIndigo.copy(alpha = 0.15f)
                        else -> CyberBorder.copy(alpha = 0.15f)
                    }, RoundedCornerShape(6.dp)
                )
                .padding(horizontal = 6.dp, vertical = 3.dp)
        ) {
            Text(
                text = "${caseItem.priority.uppercase()} RISK",
                color = when(caseItem.priority) {
                    "Critical" -> NeonRed
                    "High" -> NeonAmber
                    "Medium" -> NeonIndigo
                    else -> CyberTextSecondary
                },
                fontSize = 8.5.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }

    Spacer(modifier = Modifier.height(14.dp))

    // Sub-Tab Switcher rows
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        val menuTitles = listOf("Tasks", "Vault (OCR)", "Approval", "AI Checks")
        menuTitles.forEachIndexed { i, title ->
            val isSel = detailsTab == i
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(6.dp))
                    .background(if (isSel) NeonIndigo else SleekContainer)
                    .clickable { detailsTab = i }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = title,
                    color = if (isSel) Color.White else CyberTextSecondary,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }

    Spacer(modifier = Modifier.height(12.dp))

    // Switch Panel layouts
    when(detailsTab) {
        0 -> {
            // WORKFLOW CHECKLIST
            val caseTasks = viewModel.agosTasks.filter { it.caseId == caseItem.id }
            Column(modifier = Modifier.fillMaxSize()) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = "TASK CHECKLIST", color = CyberTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(text = "${caseTasks.filter { it.status == "Completed" }.size}/${caseTasks.size} Done", color = NeonGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.height(8.dp))

                if (caseTasks.isEmpty()) {
                    Text("No tasks generated for this case workflow.", color = CyberTextSecondary, fontSize = 11.sp)
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(caseTasks) { t ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SleekContainer),
                            border = BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(8.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                val isDone = t.status == "Completed"
                                Checkbox(
                                    checked = isDone,
                                    onCheckedChange = {
                                        if (!isDone) {
                                            viewModel.completeAgosTask(t.id)
                                        }
                                    },
                                    colors = CheckboxDefaults.colors(checkedColor = NeonGreen, checkmarkColor = Color.White)
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = t.title,
                                        color = if (isDone) CyberTextSecondary else Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = t.description,
                                        color = CyberTextSecondary,
                                        fontSize = 9.sp
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .background(if (isDone) NeonGreen.copy(alpha = 0.15f) else NeonAmber.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 4.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = t.status.uppercase(),
                                        color = if (isDone) NeonGreen else NeonAmber,
                                        fontSize = 8.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
        1 -> {
            // DOCUMENT VAULT & GEMINI OCR PROCESSOR
            val caseDocs = viewModel.agosDocuments.filter { it.caseId == caseItem.id }
            var uploadFileName by remember { mutableStateOf("") }
            var uploadFileType by remember { mutableStateOf("application/pdf") }

            Column(modifier = Modifier.fillMaxSize()) {
                Text(text = "DOCUMENT VAULT (S3/R2 STORAGE)", color = CyberTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(10.dp))

                // Simulated Secure File Input Form
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = SleekContainer),
                    border = BorderStroke(1.dp, CyberBorder)
                ) {
                    Column(modifier = Modifier.padding(10.dp)) {
                        Text(text = "SIMULATE SECURE UPLOAD TO VAULT", color = NeonCyan, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(6.dp))
                        OutlinedTextField(
                            value = uploadFileName,
                            onValueChange = { uploadFileName = it },
                            placeholder = { Text("Enter Document Name (e.g. pan_id.pdf)", color = CyberTextSecondary, fontSize = 11.sp) },
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonIndigo, unfocusedBorderColor = CyberBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            shape = RoundedCornerShape(8.dp),
                            singleLine = true
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth()) {
                            Button(
                                onClick = {
                                    if (uploadFileName.isNotBlank()) {
                                        viewModel.simulateDocumentUpload(caseItem.id, caseItem.clientId, uploadFileName, uploadFileType, viewModel.currentUserName)
                                        uploadFileName = ""
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = NeonIndigo),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(34.dp)
                                    .testTag("upload_file_action"),
                                contentPadding = PaddingValues(top = 2.dp, bottom = 2.dp),
                                shape = RoundedCornerShape(6.dp),
                                enabled = uploadFileName.isNotBlank()
                            ) {
                                Icon(Icons.Default.CloudUpload, contentDescription = "Upload", tint = Color.White, modifier = Modifier.size(14.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("SECURE UPLOAD", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Vault Doc List View
                LazyColumn(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(caseDocs) { doc ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = SleekContainer),
                            border = BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f))
                        ) {
                            Column(modifier = Modifier.padding(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(text = doc.fileName, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        Text(text = "Type: ${doc.fileType} • Uploaded by: ${doc.uploadedBy}", color = CyberTextSecondary, fontSize = 8.5.sp)
                                    }
                                    
                                    // Trigger OCR action
                                    val isRunningThis = viewModel.isDocOcrRunning && viewModel.activeOcrDocId == doc.id
                                    Button(
                                        onClick = { viewModel.triggerOcrExtraction(doc.id) },
                                        colors = ButtonDefaults.buttonColors(containerColor = if (doc.isOcrDone) NeonGreen.copy(alpha = 0.15f) else NeonCyan),
                                        modifier = Modifier.height(28.dp),
                                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                                        shape = RoundedCornerShape(6.dp),
                                        enabled = !viewModel.isDocOcrRunning
                                    ) {
                                        if (isRunningThis) {
                                            CircularProgressIndicator(color = Color.White, modifier = Modifier.size(12.dp), strokeWidth = 1.5.dp)
                                        } else {
                                            Icon(
                                                imageVector = if (doc.isOcrDone) Icons.Default.Check else Icons.Default.Bolt,
                                                contentDescription = "OCR trigger",
                                                tint = if (doc.isOcrDone) NeonGreen else Color.White,
                                                modifier = Modifier.size(12.dp)
                                            )
                                            Spacer(modifier = Modifier.width(4.dp))
                                            Text(if (doc.isOcrDone) "OCR EXTRACTION" else "RUN OCR", fontSize = 9.sp)
                                        }
                                    }
                                }

                                if (doc.isOcrDone) {
                                    Spacer(modifier = Modifier.height(10.dp))
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(Color.Black.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                                            .padding(8.dp)
                                    ) {
                                        Text(
                                            text = doc.ocrText,
                                            fontFamily = FontFamily.Monospace,
                                            fontSize = 9.sp,
                                            color = Color(0xFF94A3B8),
                                            lineHeight = 12.sp
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        2 -> {
            // COUNSEL SIGN OFF & HISTORIC APPROVALS
            var commentText by remember { mutableStateOf("") }
            val approvalChain = viewModel.agosApprovals.filter { it.caseId == caseItem.id }

            Column(modifier = Modifier.fillMaxSize()) {
                Text(text = "FOUNDING COUNSEL SIGN-OFF LOGS", color = CyberTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(8.dp))

                if (approvalChain.isEmpty()) {
                    Text("No decisions submitted for this case folder.", color = CyberTextSecondary, fontSize = 11.sp)
                } else {
                    LazyColumn(modifier = Modifier.weight(0.5f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(approvalChain) { app ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(SleekContainer, RoundedCornerShape(6.dp))
                                    .padding(8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column {
                                    Text(text = app.approverId, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 11.sp)
                                    Text(text = "\"${app.comments}\"", color = CyberTextSecondary, fontSize = 9.sp)
                                }
                                Box(
                                    modifier = Modifier
                                        .background(if (app.status == "Approved") NeonGreen.copy(alpha = 0.15f) else NeonRed.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(text = app.status, color = if (app.status == "Approved") NeonGreen else NeonRed, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                Divider(color = CyberBorder, thickness = 1.dp)
                Spacer(modifier = Modifier.height(10.dp))

                Text(text = "SUBMIT EXECUTIVE OPINION", color = NeonAmber, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(6.dp))
                OutlinedTextField(
                    value = commentText,
                    onValueChange = { commentText = it },
                    placeholder = { Text("Write comments or list missing documents...", color = CyberTextSecondary, fontSize = 11.sp) },
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = NeonIndigo, unfocusedBorderColor = CyberBorder, focusedTextColor = Color.White, unfocusedTextColor = Color.White),
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                )

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            if (commentText.isNotBlank()) {
                                viewModel.submitCaseApproval(caseItem.id, commentText, false)
                                commentText = ""
                            }
                        },
                        modifier = Modifier.weight(1.1f).testTag("reject_case_action"),
                        border = BorderStroke(1.dp, NeonRed),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = NeonRed),
                        enabled = commentText.isNotBlank()
                    ) {
                        Text("REJECT CASE", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                    Button(
                        onClick = {
                            if (commentText.isNotBlank()) {
                                viewModel.submitCaseApproval(caseItem.id, commentText, true)
                                commentText = ""
                            }
                        },
                        modifier = Modifier.weight(1.3f).testTag("approve_case_action"),
                        colors = ButtonDefaults.buttonColors(containerColor = NeonGreen),
                        enabled = commentText.isNotBlank()
                    ) {
                        Text("COUNSEL CONSENT APPROVE", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        3 -> {
            // AUTOMATED COMPLIANCE VERIFICATION RISKS CHECKS
            Column(modifier = Modifier.fillMaxSize()) {
                Text(text = "AUTOMATED SLA & RISK REPORT", color = CyberTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(SleekContainer, RoundedCornerShape(8.dp))
                        .padding(12.dp)
                ) {
                    Icon(Icons.Default.VerifiedUser, contentDescription = "Shield", tint = NeonGreen, modifier = Modifier.size(24.dp))
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text("SLA GUARANTEE COMPLIANT", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("Case folder operations are currently 12 hours ahead of SLA guidelines target.", color = CyberTextSecondary, fontSize = 10.sp)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Text(
                    text = "WORKFORCE INTELLIGENCE VERDICTS:",
                    color = NeonCyan,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(6.dp))

                // Static high impact compliance lists
                CompliancePill(title = "Identity verification", status = "PASS (Confidence: 99.4%)", color = NeonGreen)
                CompliancePill(title = "CIBIL Score status", status = "PASS (CIBIL: 785)", color = NeonGreen)
                CompliancePill(title = "Property Title Clearance", status = "PASS (No active encumbrance detected)", color = NeonGreen)
                CompliancePill(title = "Borrower Income verification", status = "ALERT Mismatches flagged by Compliance AI", color = NeonRed)
            }
        }
    }
}

@Composable
fun CompliancePill(title: String, status: String, color: Color) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .background(CyberBg, RoundedCornerShape(4.dp))
            .border(BorderStroke(1.dp, CyberBorder.copy(alpha = 0.5f)), RoundedCornerShape(4.dp))
            .padding(8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text = title, color = Color.White, fontSize = 10.sp)
        Text(text = status, color = color, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}
