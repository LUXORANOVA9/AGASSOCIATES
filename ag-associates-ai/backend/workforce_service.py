from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class WorkforceMember(BaseModel):
    id: str
    name: str
    type: str # human, agent
    role: str
    status: str
    load_score: int

class WorkforceTask(BaseModel):
    id: str
    assigned_to: str
    description: str
    priority: str
    status: str

class WorkforceService:
    def __init__(self):
        # In a real app, this would query Supabase
        self.members: Dict[str, WorkforceMember] = {}
        self.tasks: List[WorkforceTask] = []

    def assign_task(self, case_id: str, member_id: str, description: str, priority: str = "med"):
        """Assigns a task to a member (human or agent)."""
        task_id = f"task_{len(self.tasks) + 1}"
        task = WorkforceTask(
            id=task_id,
            assigned_to=member_id,
            description=description,
            priority=priority,
            status="todo"
        )
        self.tasks.append(task)
        logger.info(f"Task {task_id} assigned to {member_id}")
        
        # If member is an agent, we could trigger it here
        return task

    def update_agent_status(self, agent_name: str, status: str, load_score: int):
        """Allows agents to self-report their health/status."""
        logger.info(f"Agent {agent_name} reporting status: {status} (Load: {load_score}%)")
        # Update logic here
        return True

workforce_service = WorkforceService()
