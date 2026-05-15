
import { pool } from '../db.ts';
import { Case, CaseStatus } from '../../types/domain.ts';

export const CaseService = {
  async getActiveCases(): Promise<Case[]> {
    const res = await pool.query('SELECT * FROM cases ORDER BY sla_deadline ASC');
    return res.rows;
  },

  async getCaseById(id: string): Promise<Case | null> {
    const res = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
    return res.rows[0] || null;
  },

  async createCase(data: Partial<Case>): Promise<Case> {
    const { 
      org_id, bank_id, case_type, borrower_name, loan_amount, 
      professional_fee, sla_deadline 
    } = data;
    
    // Simple case number generator for now
    const caseNumber = `AGA-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

    const res = await pool.query(
      `INSERT INTO cases (case_number, org_id, bank_id, case_type, borrower_name, loan_amount, professional_fee, sla_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [caseNumber, org_id, bank_id, case_type, borrower_name, loan_amount, professional_fee, sla_deadline]
    );
    return res.rows[0];
  },

  async updateStatus(id: string, status: CaseStatus, userId: string, notes?: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const currentCase = await client.query('SELECT status FROM cases WHERE id = $1', [id]);
      const oldStatus = currentCase.rows[0].status;

      await client.query('UPDATE cases SET status = $1 WHERE id = $2', [status, id]);
      
      await client.query(
        `INSERT INTO case_timeline (case_id, status_from, status_to, notes, changed_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, oldStatus, status, notes, userId]
      );
      
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};
