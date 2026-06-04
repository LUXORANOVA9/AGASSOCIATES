import crypto from "crypto";
import { pool } from "../db.ts";

export type TeamRole = "ADVOCATE" | "EXECUTIVE" | "CLERK";
export type SeatStatus = "PENDING_INVITE" | "ACTIVE" | "DEACTIVATED";

export interface TeamMember {
  id: string;
  org_id: string;
  advocate_id: string;
  member_id: string | null;
  invite_email: string;
  role: TeamRole;
  seat_status: SeatStatus;
  invite_token: string | null;
  invited_at: Date;
  invite_expires_at: Date;
  joined_at: Date | null;
  deactivated_at: Date | null;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  on_duty: boolean;
  otp_bank_filter: string[] | null;
  created_at: Date;
  updated_at: Date;
}

export class TeamService {
  static async inviteStaff(
    advocateId: string,
    orgId: string,
    inviteEmail: string,
    role: TeamRole
  ): Promise<{ member: TeamMember; invite_url: string }> {
    if (!["ADVOCATE", "EXECUTIVE", "CLERK"].includes(role)) {
      throw Object.assign(new Error("Role must be ADVOCATE, EXECUTIVE, or CLERK"), { status: 400 });
    }

    const existing = await pool.query<TeamMember>(
      `SELECT * FROM team_members
       WHERE org_id = $1 AND invite_email = $2 AND seat_status = 'PENDING_INVITE'`,
      [orgId, inviteEmail]
    );
    if (existing.rows.length > 0) {
      throw Object.assign(
        new Error("A pending invite already exists for this email"),
        { status: 409 }
      );
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const insertResult = await pool.query<TeamMember>(
      `INSERT INTO team_members
         (org_id, advocate_id, invite_email, role, seat_status, invite_token)
       VALUES ($1, $2, $3, $4, 'PENDING_INVITE', $5)
       RETURNING *`,
      [orgId, advocateId, inviteEmail, role, inviteToken]
    );

    const member = insertResult.rows[0];
    const baseUrl = process.env.AG_PLATFORM_PUBLIC_URL || "http://localhost:3000";
    const invite_url = `${baseUrl}/accept-invite?token=${inviteToken}`;

    return { member, invite_url };
  }

  static async listTeam(advocateId: string, orgId: string): Promise<TeamMember[]> {
    const result = await pool.query<TeamMember>(
      `SELECT * FROM team_members
       WHERE org_id = $1 AND advocate_id = $2
       ORDER BY seat_status ASC, invited_at DESC`,
      [orgId, advocateId]
    );
    return result.rows;
  }

  static async getInviteByToken(token: string): Promise<TeamMember | null> {
    const result = await pool.query<TeamMember>(
      `SELECT * FROM team_members
       WHERE invite_token = $1
         AND seat_status = 'PENDING_INVITE'
         AND invite_expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    return result.rows[0] ?? null;
  }

  static async acceptInvite(
    token: string,
    memberId: string
  ): Promise<TeamMember> {
    const invite = await this.getInviteByToken(token);
    if (!invite) {
      throw Object.assign(
        new Error("Invite token is invalid or expired"),
        { status: 404 }
      );
    }

    const result = await pool.query<TeamMember>(
      `UPDATE team_members
       SET seat_status = 'ACTIVE',
           member_id = $1,
           joined_at = NOW(),
           invite_token = NULL
       WHERE id = $2
       RETURNING *`,
      [memberId, invite.id]
    );
    return result.rows[0];
  }

  static async setOnDuty(memberId: string, onDuty: boolean): Promise<TeamMember> {
    const result = await pool.query<TeamMember>(
      `UPDATE team_members
       SET on_duty = $1
       WHERE member_id = $2 AND seat_status = 'ACTIVE'
       RETURNING *`,
      [onDuty, memberId]
    );
    if (result.rows.length === 0) {
      throw Object.assign(
        new Error("Active team member not found"),
        { status: 404 }
      );
    }
    return result.rows[0];
  }

  static async setTelegramBinding(
    memberId: string,
    chatId: string,
    username: string | null
  ): Promise<TeamMember> {
    const result = await pool.query<TeamMember>(
      `UPDATE team_members
       SET telegram_chat_id = $1,
           telegram_username = $2
       WHERE member_id = $3
       RETURNING *`,
      [chatId, username, memberId]
    );
    if (result.rows.length === 0) {
      throw Object.assign(
        new Error("Team member not found for telegram binding"),
        { status: 404 }
      );
    }
    return result.rows[0];
  }

  static async deactivate(advocateId: string, memberId: string): Promise<TeamMember> {
    const result = await pool.query<TeamMember>(
      `UPDATE team_members
       SET seat_status = 'DEACTIVATED',
           deactivated_at = NOW(),
           on_duty = FALSE
       WHERE advocate_id = $1 AND member_id = $2
       RETURNING *`,
      [advocateId, memberId]
    );
    if (result.rows.length === 0) {
      throw Object.assign(
        new Error("Team member not found under this advocate"),
        { status: 404 }
      );
    }
    return result.rows[0];
  }

  static async findOnDutyStaff(
    orgId: string,
    bankId: string | null
  ): Promise<TeamMember[]> {
    const result = await pool.query<TeamMember>(
      `SELECT * FROM team_members
       WHERE org_id = $1
         AND seat_status = 'ACTIVE'
         AND on_duty = TRUE
         AND telegram_chat_id IS NOT NULL
         AND ($2::uuid IS NULL OR otp_bank_filter IS NULL OR $2::uuid = ANY(otp_bank_filter))
       ORDER BY on_duty DESC, joined_at ASC`,
      [orgId, bankId]
    );
    return result.rows;
  }
}
