import express from 'express';
import { pool } from '../db.ts';
import { calculateBillableFee } from '../../lib/billing.ts';

const router = express.Router();

// Get timesheets for a case or organization
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
