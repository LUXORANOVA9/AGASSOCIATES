package com.example.data

import java.util.UUID

data class AgosClient(
    val id: String = UUID.randomUUID().toString(),
    val clientName: String,
    val companyName: String,
    val phone: String,
    val email: String,
    val address: String,
    val city: String,
    val state: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class AgosCase(
    val id: String = UUID.randomUUID().toString(),
    val caseNumber: String,
    val clientId: String,
    val clientName: String,
    val serviceType: String, // "Mortgage Processing", "NOI Processing", "Legal Verification", "Property Registration", "Notice Management"
    val status: String,      // "Waiting", "Working", "Review", "Completed"
    val priority: String,    // "Low", "Medium", "High", "Critical"
    val assignedTo: String,  // e.g. "Operations Executive", "Relationship Manager", "Legal Executive"
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)

data class AgosTask(
    val id: String = UUID.randomUUID().toString(),
    val caseId: String,
    val title: String,
    val description: String,
    val assignedTo: String,
    val status: String,     // "Pending", "Executing", "Completed"
    val dueDate: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class AgosDocument(
    val id: String = UUID.randomUUID().toString(),
    val caseId: String,
    val clientId: String,
    val fileName: String,
    val fileUrl: String,
    val fileType: String,
    val version: Int = 1,
    val uploadedBy: String,
    val createdAt: Long = System.currentTimeMillis(),
    val ocrText: String = "",
    val isOcrDone: Boolean = false
)

data class AgosNote(
    val id: String = UUID.randomUUID().toString(),
    val caseId: String,
    val userId: String,
    val content: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class AgosApproval(
    val id: String = UUID.randomUUID().toString(),
    val caseId: String,
    val approverId: String,
    val status: String,     // "Pending", "Approved", "Rejected"
    val comments: String,
    val approvedAt: Long = System.currentTimeMillis()
)

data class AgosNotification(
    val id: String = UUID.randomUUID().toString(),
    val userId: String = "Aditya Gade",
    val title: String,
    val message: String,
    var readStatus: Boolean = false,
    val createdAt: Long = System.currentTimeMillis()
)

data class AgosAIJob(
    val id: String = UUID.randomUUID().toString(),
    val agentName: String,
    val taskId: String,
    val status: String,     // "Running", "Completed", "Failed"
    val inputData: String,
    val outputData: String,
    val startedAt: Long = System.currentTimeMillis(),
    val completedAt: Long = System.currentTimeMillis()
)

data class AIEmployee(
    val id: String,
    val name: String,
    val purpose: String,
    val responsibilities: List<String>,
    var column: String, // "Waiting", "Working", "Review", "Completed"
    var currentTask: String,
    var progress: Float,
    var handoverStatus: String,
    var estimatedCompletion: String,
    val iconName: String
)
