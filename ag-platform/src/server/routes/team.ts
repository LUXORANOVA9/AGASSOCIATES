import express from "express";
import { TeamService, type TeamRole } from "../services/teamService.ts";

const router = express.Router();

router.post("/team/invite", async (req, res) => {
  try {
    const { advocateId, orgId, email, role } = req.body ?? {};
    if (!advocateId || !orgId || !email || !role) {
      return res.status(400).json({
        error: "Missing required fields: advocateId, orgId, email, role",
      });
    }
    const { member, invite_url } = await TeamService.inviteStaff(
      advocateId,
      orgId,
      email,
      role as TeamRole
    );
    res.status(201).json({ member, invite_url });
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

router.get("/team", async (req, res) => {
  try {
    const advocateId = String(req.query.advocateId ?? "");
    const orgId = String(req.query.orgId ?? "");
    if (!advocateId || !orgId) {
      return res.status(400).json({ error: "advocateId and orgId required" });
    }
    const team = await TeamService.listTeam(advocateId, orgId);
    res.json(team);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

router.post("/team/accept-invite", async (req, res) => {
  try {
    const { token, memberId } = req.body ?? {};
    if (!token || !memberId) {
      return res.status(400).json({ error: "token and memberId required" });
    }
    const member = await TeamService.acceptInvite(token, memberId);
    res.json(member);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

router.patch("/team/on-duty", async (req, res) => {
  try {
    const { memberId, onDuty } = req.body ?? {};
    if (!memberId || typeof onDuty !== "boolean") {
      return res.status(400).json({ error: "memberId and onDuty required" });
    }
    const member = await TeamService.setOnDuty(memberId, onDuty);
    res.json(member);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

router.post("/team/telegram-bind", async (req, res) => {
  try {
    const { memberId, chatId, username } = req.body ?? {};
    if (!memberId || !chatId) {
      return res.status(400).json({ error: "memberId and chatId required" });
    }
    const member = await TeamService.setTelegramBinding(
      memberId,
      chatId,
      username ?? null
    );
    res.json(member);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

router.delete("/team/:memberId", async (req, res) => {
  try {
    const { advocateId } = req.body ?? {};
    if (!advocateId) {
      return res.status(400).json({ error: "advocateId required" });
    }
    const member = await TeamService.deactivate(advocateId, req.params.memberId);
    res.json(member);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

router.get("/team/on-duty", async (req, res) => {
  try {
    const orgId = String(req.query.orgId ?? "");
    const bankId = req.query.bankId ? String(req.query.bankId) : null;
    if (!orgId) {
      return res.status(400).json({ error: "orgId required" });
    }
    const staff = await TeamService.findOnDutyStaff(orgId, bankId);
    res.json(staff);
  } catch (err: any) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
