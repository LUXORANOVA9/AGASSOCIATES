import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.ts';
import { calculateBillableFee } from '../../lib/billing.ts';

const router = express.Router();
const DEV_USER_ID = '28a4eb7d-162c-4161-817d-20c30ffa5f46';
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

function setUser(req: express.Request) {
  if (!SUPABASE_JWT_SECRET) {
    (req as any).user = { sub: DEV_USER_ID, role: 'admin', email: 'dev@local' };
    return;
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as any;
      (req as any).user = { sub: decoded.sub || DEV_USER_ID, role: decoded.app_metadata?.role || 'applicant', email: decoded.email };
    } catch { /* ignore */ }
  }
}

router.use('/timesheets', (req, _res, next) => { setUser(req); next(); });

router.get('/timesheets', async (req, res) => {
  try {
    const { case_id, org_id } = req.query;
    let query = 'SELECT t.*, p.full_name as advocate_name FROM timesheets t JOIN profiles p ON t.profile_id = p.id WHERE 1=1';
    const params: any[] = [];
    
    if (case_id) {
      params.push(case_id);
      query += ` AND t.case_id = $${params.length}`;
    }
    
    if (org_id) {
      params.push(org_id);
      query += ` AND t.org_id = $${params.length}`;
    }
    
    query += ' ORDER BY t.created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timesheets' });
  }
});

// Log a new timesheet entry
router.post('/timesheets', async (req, res) => {
  try {
    const { 
      org_id, case_id, profile_id, task_description, 
      start_time, end_time, duration_minutes, is_billable, hourly_rate 
    } = req.body;
    
    const result = await pool.query(
      `INSERT INTO timesheets 
       (org_id, case_id, profile_id, task_description, start_time, end_time, duration_minutes, is_billable, hourly_rate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [org_id, case_id, profile_id, task_description, start_time, end_time, duration_minutes, is_billable, hourly_rate]
    );
    
    // Also update professional fee on the case if billable
    if (is_billable && hourly_rate && duration_minutes !== undefined) {
        const addedFee = calculateBillableFee(duration_minutes, hourly_rate);
        await pool.query(
            `UPDATE cases SET professional_fee = professional_fee + $1 WHERE id = $2`,
            [addedFee, case_id]
        );
    }
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Timesheet error:", error);
    res.status(500).json({ error: 'Failed to log timesheet' });
  }
});

export default router;
