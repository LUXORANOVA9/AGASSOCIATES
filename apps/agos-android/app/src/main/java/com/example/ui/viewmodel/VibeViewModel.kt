package com.example.ui.viewmodel

import android.app.Application
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.data.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class VibeViewModel(application: Application) : AndroidViewModel(application) {

    private val database = AppDatabase.getDatabase(application)
    private val repository = VibeRepository(database.vibeDao())

    // UI exposed states from DB
    val pullRequests: StateFlow<List<PullRequest>> = repository.allPullRequests.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val deploymentRuns: StateFlow<List<DeploymentRun>> = repository.allDeploymentRuns.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val orchestratorLogs: StateFlow<List<OrchestratorLog>> = repository.recentLogs.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    // Interactive deployment terminal simulation state
    val terminalLines = mutableStateListOf<String>()
    var isDeploying by mutableStateOf(false)
        private set
    var deployProgress by mutableStateOf(0.0f)
        private set
    var currentDeployStatusText by mutableStateOf("Idle")
        private set

    // Semantic Analyzer State
    var isAnalyzing by mutableStateOf(false)
    var analysisResult by mutableStateOf<PRAnalysisResult?>(null)
    var isApiKeyAvailable by mutableStateOf(GeminiService.isApiKeyAvailable())

    // Config custom variables
    var customPostgresUrl by mutableStateOf("postgresql://ag_associates_admin:change_me@host.docker.internal:5432/ag_associates_db")
    var customVllmPort by mutableStateOf("8000")
    var customCaddyDomain by mutableStateOf("ag-associates.ai")

    // Smart Technical Advisor properties
    var advisorQuery by mutableStateOf("")
    var advisorResponse by mutableStateOf("Type an architectural query or consult suggestions below (e.g., \"How does LangGraph integrate?\", \"What are the database vector dimensions?\") to begin.")
    var isQueryingAdvisor by mutableStateOf(false)

    // ========================================================
    // AGOS (AG OPERATIONS SYSTEM) ECOSYSTEM PROPERTIES & STATES
    // ========================================================
    val agosClients = mutableStateListOf<AgosClient>()
    val agosCases = mutableStateListOf<AgosCase>()
    val agosTasks = mutableStateListOf<AgosTask>()
    val agosDocuments = mutableStateListOf<AgosDocument>()
    val agosApprovals = mutableStateListOf<AgosApproval>()
    val agosNotifications = mutableStateListOf<AgosNotification>()
    val agosAIEmployees = mutableStateListOf<AIEmployee>()

    // Current User Session State (MVP Authentication)
    var currentUserEmail by mutableStateOf("rajkhemani24@gmail.com")
    var currentUserName by mutableStateOf("Aditya Gade")
    var currentUserRole by mutableStateOf("Founder & Admin")
    var isAuthenticated by mutableStateOf(true) // Starts true, user can toggle/signout

    // OCR running status indicator
    var isDocOcrRunning by mutableStateOf(false)
    var activeOcrDocId by mutableStateOf<String?>(null)

    // Trigger AI Employee Workflow loading indicator
    var isAIWorkflowActive by mutableStateOf(false)
    var activeWorkflowAgentId by mutableStateOf<String?>(null)

    fun loginUser(email: String, name: String) {
        currentUserEmail = email
        currentUserName = name
        currentUserRole = if (email.lowercase().contains("admin") || name.lowercase().contains("aditya")) "Founder & Admin" else "Operations Executive"
        isAuthenticated = true
        
        viewModelScope.launch {
            repository.insertLog(
                OrchestratorLog(
                    agentName = "System Auth",
                    message = "User authenticated successfully: $name ($currentUserRole)",
                    type = "success"
                )
            )
        }
    }

    fun logoutUser() {
        isAuthenticated = false
        currentUserName = ""
        currentUserEmail = ""
        currentUserRole = ""
    }

    fun addClient(name: String, company: String, phoneStr: String, emailStr: String, addr: String, cityStr: String, stateStr: String) {
        val client = AgosClient(
            clientName = name,
            companyName = company,
            phone = phoneStr,
            email = emailStr,
            address = addr,
            city = cityStr,
            state = stateStr
        )
        agosClients.add(client)

        viewModelScope.launch {
            repository.insertLog(
                OrchestratorLog(
                    agentName = "Receptionist AI",
                    message = "Onboarded client: ${client.clientName} (${client.companyName}). Profile created.",
                    type = "success"
                )
            )
            agosNotifications.add(
                AgosNotification(
                    title = "New Client Onboarded",
                    message = "Receptionist AI captured profile for ${client.clientName}."
                )
            )
        }
    }

    fun createCase(number: String, clientId: String, serviceType: String, priority: String, assignedTo: String) {
        val client = agosClients.firstOrNull { it.id == clientId }
        val name = client?.clientName ?: "Unknown Client"
        val newCase = AgosCase(
            caseNumber = number,
            clientId = clientId,
            clientName = name,
            serviceType = serviceType,
            status = "Waiting",
            priority = priority,
            assignedTo = assignedTo
        )
        agosCases.add(newCase)

        // Generate automatic tasks based on Service Type
        val tasksForCase = when (serviceType) {
            "Mortgage Processing" -> listOf(
                "Review Property Title Records" to "Determine if property has any existing liens or prior claims.",
                "Verify Income documents" to "OCR analyze applicant pay slips and verification of Form 16.",
                "CIBIL Credit Assessment" to "Download and validate Credit Report status.",
                "Execute Mortgage Deed" to "Formal execution of security documents."
            )
            "NOI Processing" -> listOf(
                "Prepare Draft Notice of Intended Sale" to "Verify loan default notices and compile notice draft.",
                "Obtain Counsel Approval" to "Obtain legal sign-off from Founder Aditya Gade.",
                "Dispatch Certified Mail" to "Dispatch notices via certified speed post."
            )
            "Property Registration" -> listOf(
                "Verify Stamping Duty" to "Calculate stamp value charges matching government rules.",
                "Present at Registrar Office" to "Represent coordinates offline at the sub-registrar branch."
            )
            else -> listOf(
                "Draft Initial Notice Copy" to "Prepare base templates matching standard civil litigation criteria.",
                "Send WhatsApp automated copy" to "Automate a digital trace copy via Whatsapp webhook endpoints."
            )
        }

        tasksForCase.forEach { (title, desc) ->
            createAgosTask(
                caseId = newCase.id,
                title = title,
                description = desc,
                assignedTo = assignedTo,
                dueDate = "In 3 Days"
            )
        }

        viewModelScope.launch {
            repository.insertLog(
                OrchestratorLog(
                    agentName = "Operations AI",
                    message = "Created new case $number ($serviceType) - Generated ${tasksForCase.size} tasks.",
                    type = "info"
                )
            )
            agosNotifications.add(
                AgosNotification(
                    title = "New Case Created",
                    message = "Operations AI converted request into workflow case $number ($serviceType)."
                )
            )
        }
    }

    fun updateCaseStatus(caseId: String, newStatus: String) {
        val index = agosCases.indexOfFirst { it.id == caseId }
        if (index != -1) {
            val oldCase = agosCases[index]
            agosCases[index] = oldCase.copy(status = newStatus, updatedAt = System.currentTimeMillis())

            viewModelScope.launch {
                repository.insertLog(
                    OrchestratorLog(
                        agentName = "Operations AI",
                        message = "Updated Case ${oldCase.caseNumber} status from ${oldCase.status} to $newStatus.",
                        type = "info"
                    )
                )
            }
        }
    }

    fun createAgosTask(caseId: String, title: String, description: String, assignedTo: String, dueDate: String) {
        val task = AgosTask(
            caseId = caseId,
            title = title,
            description = description,
            assignedTo = assignedTo,
            status = "Pending",
            dueDate = dueDate
        )
        agosTasks.add(task)
    }

    fun completeAgosTask(taskId: String) {
        val index = agosTasks.indexOfFirst { it.id == taskId }
        if (index != -1) {
            val oldTask = agosTasks[index]
            agosTasks[index] = oldTask.copy(status = "Completed")

            viewModelScope.launch {
                repository.insertLog(
                    OrchestratorLog(
                        agentName = "Operations AI",
                        message = "Task completed: \"${oldTask.title}\" on assigned workflow.",
                        type = "success"
                    )
                )
                // If all tasks for Case are complete, suggest Review/Completed status
                val caseId = oldTask.caseId
                val outstanding = agosTasks.filter { it.caseId == caseId && it.status != "Completed" }
                if (outstanding.isEmpty()) {
                    agosNotifications.add(
                        AgosNotification(
                            title = "Case Pipeline Complete",
                            message = "Operations AI: All tasks for case are done. Recommended transition to Completed status."
                        )
                    )
                }
            }
        }
    }

    fun simulateDocumentUpload(caseId: String, clientId: String, fileName: String, fileType: String, uploadedBy: String) {
        val newDoc = AgosDocument(
            caseId = caseId,
            clientId = clientId,
            fileName = fileName,
            fileUrl = "https://r2.agos.ai/uploads/" + fileName.replace(" ", "_"),
            fileType = fileType,
            uploadedBy = uploadedBy
        )
        agosDocuments.add(newDoc)

        viewModelScope.launch {
            repository.insertLog(
                OrchestratorLog(
                    agentName = "Document AI",
                    message = "Secure upload success: $fileName added to case.",
                    type = "success"
                )
            )
            agosNotifications.add(
                AgosNotification(
                    title = "New Document Uploaded",
                    message = "Document AI registered $fileName from $uploadedBy in the case vault."
                )
            )
        }
    }

    fun triggerOcrExtraction(docId: String) {
        if (isDocOcrRunning) return
        val docIndex = agosDocuments.indexOfFirst { it.id == docId }
        if (docIndex == -1) return
        
        isDocOcrRunning = true
        activeOcrDocId = docId

        viewModelScope.launch {
            val doc = agosDocuments[docIndex]
            repository.insertLog(
                OrchestratorLog(
                    agentName = "Document AI",
                    message = "Initiating OCR text recognition and metadata extraction of ${doc.fileName}...",
                    type = "info"
                )
            )

            try {
                // Call actual Gemini OCR analyzer
                val text = GeminiService.performDocumentOcrAndAnalysis(doc.fileName, doc.fileType)
                agosDocuments[docIndex] = doc.copy(ocrText = text, isOcrDone = true)

                repository.insertLog(
                    OrchestratorLog(
                        agentName = "Document AI",
                        message = "OCR extraction completed for ${doc.fileName} successfully.",
                        type = "success"
                    )
                )
                
                agosNotifications.add(
                    AgosNotification(
                        title = "OCR Extraction Success",
                        message = "Document AI extracted compliance metadata from ${doc.fileName}."
                    )
                )
            } catch (e: Exception) {
                Log.e("VibeViewModel", "OCR extraction error: ${e.message}", e)
            } finally {
                isDocOcrRunning = false
                activeOcrDocId = null
            }
        }
    }

    fun triggerAiEmployeeWorkflow(employeeId: String, caseId: String) {
        if (isAIWorkflowActive) return
        val empIndex = agosAIEmployees.indexOfFirst { it.id == employeeId }
        val cIndex = agosCases.indexOfFirst { it.id == caseId }
        if (empIndex == -1 || cIndex == -1) return

        isAIWorkflowActive = true
        activeWorkflowAgentId = employeeId

        viewModelScope.launch {
            val oldEmp = agosAIEmployees[empIndex]
            val actualCase = agosCases[cIndex]

            agosAIEmployees[empIndex] = oldEmp.copy(
                column = "Working",
                currentTask = "Orchestrating digital automation on Case ${actualCase.caseNumber}",
                progress = 0.15f,
                handoverStatus = "Locked onto Case ID: ${actualCase.caseNumber}",
                estimatedCompletion = "Awaiting step analysis..."
            )

            // Step-by-step state simulation reporting to the main system
            val steps = listOf(
                "Spinning container context for employee ${oldEmp.name}..." to 0.35f,
                "Loading database schema variables & validating pgvector bounds..." to 0.55f,
                "Querying agentic LangGraph state node: Intake ➔ Compliance rules..." to 0.75f,
                "Triggering automated WhatsApp webhook tracing alerts..." to 0.90f,
                "Handing over case reviews to Manager AI..." to 1.0f
            )

            for ((log, prog) in steps) {
                terminalLines.add("[AGOS DIGITAL WORKFORCE] ${oldEmp.name}: $log")
                agosAIEmployees[empIndex] = agosAIEmployees[empIndex].copy(
                    progress = prog,
                    estimatedCompletion = "${((1.0f - prog) * 20).toInt()}s"
                )
                delay(800)
            }

            // Move to Completed or Review
            val finalCol = if (employeeId == "manager" || employeeId == "compliance") "Review" else "Completed"
            agosAIEmployees[empIndex] = agosAIEmployees[empIndex].copy(
                column = finalCol,
                currentTask = "Completed processing run for ${actualCase.caseNumber} workflow",
                progress = 1.0f,
                handoverStatus = "Success. Logs posted to local SQLite schemas",
                estimatedCompletion = "Done"
            )

            // Update Case status model as side effect of trigger!
            val newCaseStatus = when (employeeId) {
                "receptionist" -> "Waiting"
                "operations" -> "Working"
                "document", "compliance" -> "Review"
                "manager", "reporting" -> "Completed"
                else -> actualCase.status
            }
            agosCases[cIndex] = actualCase.copy(status = newCaseStatus, updatedAt = System.currentTimeMillis())

            // Post log & Notification alerts
            repository.insertLog(
                OrchestratorLog(
                    agentName = oldEmp.name,
                    message = "Completed agent core responsibilities on ${actualCase.caseNumber}. Handover status: Success.",
                    type = "success"
                )
            )

            agosNotifications.add(
                AgosNotification(
                    title = "${oldEmp.name} Execution Completed",
                    message = "Successfully automated system tasks for Case ${actualCase.caseNumber}. Status: $newCaseStatus"
                )
            )

            isAIWorkflowActive = false
            activeWorkflowAgentId = null
        }
    }

    fun submitCaseApproval(caseId: String, comment: String, isApproved: Boolean) {
        val cIndex = agosCases.indexOfFirst { it.id == caseId }
        if (cIndex != -1) {
            val caseItem = agosCases[cIndex]
            val statusStr = if (isApproved) "Approved" else "Rejected"
            val newCaseStatus = if (isApproved) "Completed" else "Waiting"

            val approval = AgosApproval(
                caseId = caseId,
                approverId = currentUserName,
                status = statusStr,
                comments = comment
            )
            agosApprovals.add(approval)
            agosCases[cIndex] = caseItem.copy(status = newCaseStatus, updatedAt = System.currentTimeMillis())

            viewModelScope.launch {
                repository.insertLog(
                    OrchestratorLog(
                        agentName = "Approval Center",
                        message = "Case ${caseItem.caseNumber} has been $statusStr by $currentUserName. Action: $comment",
                        type = if (isApproved) "success" else "error"
                    )
                )
                agosNotifications.add(
                    AgosNotification(
                        title = "Case Review Action: $statusStr",
                        message = "$currentUserName $statusStr ${caseItem.caseNumber} with comments: $comment"
                    )
                )
            }
        }
    }

    fun markFeedbackRead(notificationId: String) {
        val index = agosNotifications.indexOfFirst { it.id == notificationId }
        if (index != -1) {
            agosNotifications[index] = agosNotifications[index].copy(readStatus = true)
        }
    }

    fun askArchitectAdvisor() {
        val query = advisorQuery
        if (query.isBlank()) return
        isQueryingAdvisor = true
        viewModelScope.launch {
            try {
                val ans = GeminiService.askArchitectAdvisor(query)
                advisorResponse = ans
                
                // Add system log detailing user inquiry Success
                repository.insertLog(
                    OrchestratorLog(
                        agentName = "System Architect Advisor",
                        message = "Processed developer architectural query: \"${if (query.length > 50) query.take(47) + "..." else query}\".",
                        type = "info"
                    )
                )
            } catch (e: Exception) {
                advisorResponse = "Failed to seek expert advice. Reason: ${e.message}"
            } finally {
                isQueryingAdvisor = false
            }
        }
    }

    init {
        // Prepare initial seeds
        viewModelScope.launch {
            repository.seedDatabase()
            // Pull the latest keys state in case they updated
            isApiKeyAvailable = GeminiService.isApiKeyAvailable()
            
            // Add introductory logs
            terminalLines.add("[SYSTEM] VibeCodeing AG Orchestrator initialised.")
            terminalLines.add("[SYSTEM] All 6 container cluster nodes in AGASSOCIATES workspace are responsive.")
            terminalLines.add("[SYSTEM] Select a Pull Request or run Coordinated Deploy to begin orchestration.")

            // SEED AGOS DATASETS ON FRESH BOOTUP
            seedAgosStaticSets()
        }
    }

    private fun seedAgosStaticSets() {
        // Seed 4 clients
        val client1 = AgosClient(id = "c_1", clientName = "Amit Sharma", companyName = "Individual Borrower", phone = "+91 98765 43210", email = "amit.sharma@gmail.com", address = "Sector 3, Gahunje", city = "Pune", state = "Maharashtra")
        val client2 = AgosClient(id = "c_2", clientName = "Aditi Rao", companyName = "HDFC Bank Ltd", phone = "+91 22 6652 0000", email = "lending.aditi@hdfc.com", address = "HDFC House, HT Parekh Marg", city = "Mumbai", state = "Maharashtra")
        val client3 = AgosClient(id = "c_3", clientName = "Rajesh G", companyName = "ICICI Home Finance", phone = "+91 22 2653 1414", email = "corporate.rajesh@icici.com", address = "Bandra Kurla Complex", city = "Mumbai", state = "Maharashtra")
        val client4 = AgosClient(id = "c_4", clientName = "Suresh Murthy", companyName = "Prestige Group", phone = "+91 80 2559 1080", email = "suresh@prestigeconstructions.com", address = "101, Prestige Falcon Towers", city = "Bengaluru", state = "Karnataka")
        
        agosClients.addAll(listOf(client1, client2, client3, client4))

        // Seed 4 cases
        val case1 = AgosCase(id = "case_1", caseNumber = "AG-2026-M04", clientId = "c_1", clientName = "Amit Sharma", serviceType = "Mortgage Processing", status = "Working", priority = "High", assignedTo = "Operations Executive")
        val case2 = AgosCase(id = "case_2", caseNumber = "AG-2026-N08", clientId = "c_3", clientName = "Rajesh G (ICICI)", serviceType = "NOI Processing", status = "Review", priority = "Critical", assignedTo = "Legal Executive")
        val case3 = AgosCase(id = "case_3", caseNumber = "AG-2026-R01", clientId = "c_4", clientName = "Suresh Murthy", serviceType = "Property Registration", status = "Waiting", priority = "Medium", assignedTo = "Registration Coordinator")
        val case4 = AgosCase(id = "case_4", caseNumber = "AG-2026-L03", clientId = "c_1", clientName = "Amit Sharma", serviceType = "Legal Verification", status = "Completed", priority = "Low", assignedTo = "Compliance Officer")

        agosCases.addAll(listOf(case1, case2, case3, case4))

        // Seed core tasks corresponding to these cases
        agosTasks.addAll(
            listOf(
                AgosTask(caseId = "case_1", title = "Review Property Title Records", description = "Determine if Amit Sharma property has any existing liens or prior claims.", assignedTo = "Operations Executive", status = "Completed", dueDate = "Completed"),
                AgosTask(caseId = "case_1", title = "Verify Income documents", description = "OCR analyze applicant pay slips and verify Form 16 credentials.", assignedTo = "Document AI", status = "Executing", dueDate = "Today"),
                AgosTask(caseId = "case_1", title = "CIBIL Credit Score Check", description = "Download and validate Credit Report status.", assignedTo = "Compliance AI", status = "Pending", dueDate = "Tomorrow"),
                
                AgosTask(caseId = "case_2", title = "Prepare Draft Notice of Intended Sale", description = "Verify loan default notices and compile notice draft.", assignedTo = "Legal Executive", status = "Completed", dueDate = "Completed"),
                AgosTask(caseId = "case_2", title = "Obtain Counsel Approval", description = "Obtain legal sign-off from Founder Aditya Gade.", assignedTo = "Founder", status = "Executing", dueDate = "Today"),
                
                AgosTask(caseId = "case_3", title = "Verify Stamping Duty Documents", description = "Calculate stamp value charges matching government rules.", assignedTo = "Registration Coordinator", status = "Pending", dueDate = "In 2 Days")
            )
        )

        // Seed 3 documents in vault
        agosDocuments.addAll(
            listOf(
                AgosDocument(caseId = "case_1", clientId = "c_1", fileName = "amit_sharma_pan_id.pdf", fileUrl = "https://r2.agos.ai/uploads/pan.pdf", fileType = "application/pdf", uploadedBy = "Receptionist AI", ocrText = "PAN CARD EXTRACT:\nName: Amit Sharma\nPAN: APBS9012K\nAddress matches: Yes\nVerification: Verified matching 99.4% database profile.", isOcrDone = true),
                AgosDocument(caseId = "case_1", clientId = "c_1", fileName = "property_title_clearance.pdf", fileUrl = "https://r2.agos.ai/uploads/property_deed.pdf", fileType = "application/pdf", uploadedBy = "Amit Sharma"),
                AgosDocument(caseId = "case_2", clientId = "c_2", fileName = "icici_demand_notice_template.docx", fileUrl = "https://r2.agos.ai/uploads/notice.docx", fileType = "application/vnd.openxmlformats-officedocument", uploadedBy = "Legal Executive")
            )
        )

        // Seed notifications
        agosNotifications.addAll(
            listOf(
                AgosNotification(title = "SLA Alert - NOI Process", message = "Case AG-2026-N08 Notice of Intended Sale deadline is approaching 48 hour limit."),
                AgosNotification(title = "Compliance AI anomaly flag", message = "Income payslip mismatch discovered in Case AG-2026-M04 Amit Sharma files.")
            )
        )

        // Seed 7 virtual employees
        agosAIEmployees.addAll(
            listOf(
                AIEmployee("receptionist", "Receptionist AI", "Reception and lead capture", listOf("Capture leads", "Capture service requests", "Create client profile", "Generate intake forms", "Assign priority"), "Completed", "Assigning priority & routing intake of Suresh Murthy case", 1.0f, "Routed client profile to database entries", "Done", "Person"),
                AIEmployee("operations", "Operations AI", "Workflow and task converter", listOf("Generate tasks", "Allocate work", "Track deadlines", "Escalate delays"), "Working", "Allocating tasks & deadlines to Amit Sharma Mortgage Case", 0.74f, "Generating task database schema", "4 mins", "Work"),
                AIEmployee("document", "Document AI", "File upload management & OCR parsing", listOf("Classify files", "OCR documents", "Extract metadata", "Detect missing documents"), "Working", "Awaiting OCR triggers for property_title_clearance.pdf", 0.45f, "Writing OCR outputs to Document Vault", "1 min", "FilePresent"),
                AIEmployee("compliance", "Compliance AI", "Quality validation & risk scoring", listOf("Verify checklist", "Flag inconsistencies", "Validate submissions", "Monitor SLA compliance"), "Working", "Comparing tax PAN records with applicant Amit Sharma profile", 0.25f, "Applying credit score triggers", "10 mins", "FactCheck"),
                AIEmployee("followup", "Follow-Up AI", "Automated chats, updates & alerts", listOf("Calls schedule", "Reminder scheduling", "Email generation", "WhatsApp reminders"), "Waiting", "Waiting for automated scheduler SLA logs checks", 0.0f, "Idle", "N/A", "NotificationsActive"),
                AIEmployee("manager", "Manager AI", "Oversight risk dashboard reports", listOf("Daily summary", "Risk dashboard", "Escalation dashboard", "Team performance"), "Review", "Reviewing overall SLA bottlenecks across active mortgage lines", 0.90f, "Approving daily report pipelines", "Now", "SupervisorAccount"),
                AIEmployee("reporting", "Reporting AI", "KPI tracking & BI monthly summaries", listOf("KPI generation", "Daily reports", "Client reports", "Monthly summaries"), "Waiting", "Standing by for evening scheduled reports generation", 0.0f, "Idle", "N/A", "Analytics")
            )
        )
    }


    /**
     * Initiates a highly detailed, visually stunning simulated parallel deployment flow
     */
    fun runCoordinatedDeployment(targetPRId: Int = 42, targetTitle: String = "docs: update API endpoints") {
        if (isDeploying) return
        isDeploying = true
        deployProgress = 0.0f
        terminalLines.clear()
        
        viewModelScope.launch {
            val steps = listOf(
                "Initiating zero-touch orchestrated build pipeline sequence..." to 0.05f,
                "Liveness checks: Supabase (Healthy, 12ms), Redis PING (PONG), n8n whatsapp integration status (200 OK)" to 0.12f,
                "Configuring core embedding settings: DIM=384 (all-MiniLM-L6-v2) ... Confirmed." to 0.20f,
                "Loading `.github/orchestrator.config.json` gates ... Tests Passed & Auto-Merge active." to 0.28f,
                "🛠️ Bootstrapping 6 service docker builds in parallel matrix:" to 0.35f,
                "   ├─ [ai-backend]: Setting up Python LangGraph Agent pipeline..." to 0.42f,
                "   ├─ [ai-frontend]: Bundling React NextJS client pages static pathways..." to 0.48f,
                "   ├─ [ag-platform]: Compiling Express logic + Vite components cleanly..." to 0.54f,
                "   ├─ [noi-dashboard]: Bootstrapping specialized NOI prototype console..." to 0.60f,
                "   ├─ [whatsapp-n8n]: Initializing webhook triggers & n8n workflow steps..." to 0.65f,
                "   └─ [supabase-db]: Syncing schema migrations & vector database triggers..." to 0.70f,
                "🚀 Tests suites running concurrently in safe sandboxes..." to 0.78f,
                "   ✓ vitest (ag-platform core package) -> 12 unit tests parsed" to 0.82f,
                "   ✓ pytest (ag-associates-ai agent flows) -> 8 workflow nodes matched" to 0.86f,
                "   ✓ e2e (Playwright visual regression) -> Dashboard status verified" to 0.90f,
                "Pushing tagged image snapshots to registry: ghcr.io/rajkhemani/ag-platform:latest..." to 0.95f,
                "Uploading build telemetry to docs/PR_INDEX.md & appending metrics index..." to 0.98f,
                "🎉 VIBECODEING ZERO-TOUCH AUTOMATION: DEPLOY SUCCESSFUL!" to 1.0f
            )

            for ((log, progress) in steps) {
                currentDeployStatusText = if (progress < 1.0f) "Deploying (${(progress * 100).toInt()}%)" else "Deploy Complete"
                terminalLines.add("[ORCHESTRATOR] $log")
                deployProgress = progress
                delay(700) // Beautiful delay so the logs scroll organically
            }

            // Create a success deployment log inside DB
            val randomSha = generateRandomSha()
            val newRun = DeploymentRun(
                commitSha = randomSha,
                prNumber = targetPRId,
                serviceName = "ag-platform",
                status = "Success",
                duration = "1m 45s",
                logData = terminalLines.joinToString("\n")
            )
            repository.insertRun(newRun)

            // Inject a live bot system log too
            repository.insertLog(
                OrchestratorLog(
                    agentName = "VibeCodeing Bot",
                    message = "Atomic deploy success for PR #$targetPRId ($targetTitle) on production.",
                    type = "success"
                )
            )
            isDeploying = false
        }
    }

    /**
     * Triggers a rollback sequence reverting to previous stable snapshot
     */
    fun runRollbackSequence() {
        if (isDeploying) return
        isDeploying = true
        deployProgress = 0.0f
        terminalLines.clear()

        viewModelScope.launch {
            val rollbackSteps = listOf(
                "🚨 CRITICAL ADMIN INTERVENE: Reverting active clusters to previous stable snapshot..." to 0.1f,
                "Resolving previous deployed SHA records in DB..." to 0.3f,
                "Re-routing Caddy reverse proxy subdomains to stable upstream tags..." to 0.5f,
                "Gracefully terminating zombie container processes..." to 0.7f,
                "Restoring database schema structures and rolling back pending migrations..." to 0.9f,
                "⏮️ ROLLBACK SUCCEEDED. System restored to prior stable state in 45 seconds." to 1.0f
            )

            for ((log, progress) in rollbackSteps) {
                currentDeployStatusText = if (progress < 1.0f) "Rolling Back (${(progress * 100).toInt()}%)" else "Rollback Complete"
                terminalLines.add("[ROLLBACK] $log")
                deployProgress = progress
                delay(600)
            }

            // Save rollback history in database
            val randomSha = generateRandomSha()
            val newRun = DeploymentRun(
                commitSha = randomSha,
                prNumber = 39,
                serviceName = "intake-api",
                status = "Rolled back",
                duration = "45s",
                logData = terminalLines.joinToString("\n")
            )
            repository.insertRun(newRun)

            // Insert system crash-management warning
            repository.insertLog(
                OrchestratorLog(
                    agentName = "Orchestrator",
                    message = "Administrative rollback successfully executed. All routing restored to stable cluster targets.",
                    type = "warning"
                )
            )
            isDeploying = false
        }
    }

    /**
     * Leverages the Gemini API (or the smart local algorithms) to semantic-analyze any pasted code diff or PR title!
     * Then inserts it as a real, interactive PR element in the DB so it displays in the dashboard table!
     */
    fun analyzeAndCreatePR(title: String, author: String, changesText: String, onComplete: () -> Unit) {
        if (title.isBlank()) return
        isAnalyzing = true
        analysisResult = null

        viewModelScope.launch {
            try {
                val result = GeminiService.analyzeCommit(title, changesText)
                analysisResult = result

                // Create a real new PR item in the local DB
                val randomPrId = (50..99).random()
                val newPr = PullRequest(
                    id = randomPrId,
                    title = title,
                    author = author.ifBlank { "@developer" },
                    category = result.category,
                    riskTier = result.riskTier,
                    status = if (result.riskTier == "LOW" || result.riskTier == "MEDIUM") "Ready" else "Review",
                    mergeStatus = if (result.autoMerge) "Auto" else "Manual",
                    deployStatus = result.deployStatus,
                    description = result.summary,
                    diffText = changesText
                )

                repository.insertPR(newPr)

                // Inject a log detailing the agent's work
                val analyzingAgent = listOf("Claude", "Devin", "Jules").random()
                repository.insertLog(
                    OrchestratorLog(
                        agentName = analyzingAgent,
                        message = "Semantically analyzed PR #$randomPrId. Risk: ${result.riskTier}, AutoMerge: ${result.autoMerge}.",
                        type = if (result.riskTier == "CRITICAL" || result.riskTier == "HIGH") "warning" else "info"
                    )
                )

                onComplete()
            } catch (e: Exception) {
                Log.e("VibeViewModel", "Analysis crash: ${e.message}", e)
            } finally {
                isAnalyzing = false
            }
        }
    }

    /**
     * Deletes a PR from the index
     */
    fun deletePR(pr: PullRequest) {
        viewModelScope.launch {
            repository.deletePR(pr)
            repository.insertLog(
                OrchestratorLog(
                    agentName = "VibeCodeing Bot",
                    message = "Manually pruned pull request #${pr.id} from index dashboard.",
                    type = "info"
                )
            )
        }
    }

    /**
     * Wipes database runs & logs to start fresh
     */
    fun wipeTelemetryAndReset() {
        viewModelScope.launch {
            repository.clearRuns()
            repository.clearLogs()
            // Reseed
            repository.seedDatabase()
            terminalLines.clear()
            terminalLines.add("[SYSTEM] Telemetry cache flushed and reset successfully.")
        }
    }

    private fun generateRandomSha(): String {
        val chars = "abcdef0123456789"
        return (1..7).map { chars.random() }.joinToString("")
    }
}
