"""Hierarchical Role-Based Access Control for AG Associates.

Role hierarchy (higher level = more privilege):

  PRINCIPAL (100) ── sees everything, manages firm
    ADVOCATE (80)  ── manages cases, files, client comms
      EXECUTIVE (60) ── field work, doc collection
        CLERK (40)   ── data entry, office support
          BANK_VIEWER (20) ── read-only case tracking

Permission inheritance: a role inherits all permissions of its descendants.
e.g., PRINCIPAL can do everything ADVOCATE can do, plus firm management.
"""

from __future__ import annotations
import enum
from dataclasses import dataclass, field
from typing import Optional, Callable
from fastapi import HTTPException, status


# ── Role Definitions ────────────────────────────────────────────────────

class Role(enum.IntEnum):
    BANK_VIEWER = 20
    CLERK = 40
    EXECUTIVE = 60
    ADVOCATE = 80
    PRINCIPAL = 100

    @classmethod
    def from_str(cls, s: str) -> Role:
        try:
            return cls[s.upper()]
        except KeyError:
            raise ValueError(f"Unknown role: {s}")

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()

    def can_access(self, resource_level: int) -> bool:
        """Check if this role's level >= required level (inheritance)."""
        return self.value >= resource_level

    def inherits(self) -> list[Role]:
        """Return all roles this role inherits from (lower levels)."""
        return [r for r in Role if r.value < self.value]


# ── Granular Permissions ────────────────────────────────────────────────

@dataclass(frozen=True)
class Permission:
    """A granular action within the system, gated by a minimum role level."""
    code: str
    label: str
    min_role_level: int  # Minimum Role.value required

# Grouped by domain
FIRM_PERMISSIONS = [
    Permission("firm.manage_users", "Manage users & roles", Role.PRINCIPAL.value),
    Permission("firm.manage_billing", "Manage billing & invoices", Role.PRINCIPAL.value),
    Permission("firm.view_analytics", "View firm-wide analytics", Role.PRINCIPAL.value),
    Permission("firm.audit_log", "View audit logs", Role.ADVOCATE.value),
]

CASE_PERMISSIONS = [
    Permission("case.create", "Create new case", Role.EXECUTIVE.value),
    Permission("case.view_all", "View all firm cases", Role.ADVOCATE.value),
    Permission("case.view_assigned", "View own assigned cases", Role.CLERK.value),
    Permission("case.assign", "Assign cases to staff", Role.ADVOCATE.value),
    Permission("case.update_status", "Update case status", Role.EXECUTIVE.value),
    Permission("case.delete", "Delete a case", Role.PRINCIPAL.value),
    Permission("case.escalate", "Escalate case to advocate", Role.EXECUTIVE.value),
]

NOI_PERMISSIONS = [
    Permission("noi.initiate", "Initiate NOI process", Role.ADVOCATE.value),
    Permission("noi.file", "File NOI on IGR portal", Role.ADVOCATE.value),
    Permission("noi.verify_docs", "Verify intake documents", Role.EXECUTIVE.value),
    Permission("noi.generate_challan", "Generate GRAS challan", Role.ADVOCATE.value),
    Permission("noi.pay_challan", "Approve challan payment", Role.ADVOCATE.value),
    Permission("noi.view_progress", "View NOI progress", Role.CLERK.value),
]

COMMS_PERMISSIONS = [
    Permission("comms.send_email", "Send email to bank/client", Role.ADVOCATE.value),
    Permission("comms.send_whatsapp", "Send WhatsApp message", Role.EXECUTIVE.value),
    Permission("comms.view_log", "View communication history", Role.CLERK.value),
]

RPA_PERMISSIONS = [
    Permission("rpa.run_gras", "Run GRAS portal automation", Role.ADVOCATE.value),
    Permission("rpa.run_igr", "Run IGR e-filing", Role.ADVOCATE.value),
    Permission("rpa.view_logs", "View RPA execution logs", Role.EXECUTIVE.value),
]

REPORT_PERMISSIONS = [
    Permission("reports.view_dashboard", "View main dashboard", Role.CLERK.value),
    Permission("reports.view_analytics", "View advanced analytics", Role.ADVOCATE.value),
    Permission("reports.export", "Export case data", Role.ADVOCATE.value),
]

ALL_PERMISSIONS = FIRM_PERMISSIONS + CASE_PERMISSIONS + NOI_PERMISSIONS + COMMS_PERMISSIONS + RPA_PERMISSIONS + REPORT_PERMISSIONS

PERMISSION_MAP: dict[str, Permission] = {p.code: p for p in ALL_PERMISSIONS}


# ── Role → Default Permissions ─────────────────────────────────────────

def permissions_for_role(role: Role) -> list[Permission]:
    """Get all permissions a role has (including inherited)."""
    effective_level = role.value
    return [p for p in ALL_PERMISSIONS if p.min_role_level <= effective_level]


def can(role: Role | str | int, permission_code: str) -> bool:
    """Check if a role has a specific permission by code."""
    if isinstance(role, str):
        role = Role.from_str(role)
    elif isinstance(role, int):
        role = Role(role)
    perm = PERMISSION_MAP.get(permission_code)
    if perm is None:
        return False
    return role.value >= perm.min_role_level


# ── FastAPI Integration ──────────────────────────────────────────────────

@dataclass
class AuthContext:
    """Injected into request handlers after auth verification."""
    user_id: str
    role: Role
    org_id: Optional[str] = None
    bank_id: Optional[str] = None
    name: str = ""

    def can(self, permission_code: str) -> bool:
        return can(self.role, permission_code)

    def require(self, permission_code: str) -> None:
        if not self.can(permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {permission_code} requires role >= {PERMISSION_MAP.get(permission_code, '?')}",
            )

    def assert_level(self, required_level: int) -> None:
        if self.role.value < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role level >= {required_level}",
            )


def require_permission(permission_code: str) -> Callable:
    """FastAPI dependency factory — use as Depends(require_permission('case.create'))."""
    def checker(auth: AuthContext = None) -> None:
        auth.require(permission_code)
    return checker
