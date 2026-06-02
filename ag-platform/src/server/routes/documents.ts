import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db.ts';

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

function authMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction) {
  setUser(req);
  next();
}

router.get('/cases/:caseId/documents', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM documents WHERE case_id = $1 ORDER BY uploaded_at DESC',
      [req.params.caseId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Document fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

router.post('/cases/:caseId/documents', authMiddleware, async (req, res) => {
  try {
    const { name, storage_path, bucket_id, content_type, size_bytes, category } = req.body;
    const user = (req as any).user;

    if (!name || !storage_path) {
      res.status(400).json({ error: 'name and storage_path are required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO documents (case_id, org_id, uploader_id, name, storage_path, bucket_id, content_type, size_bytes, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.params.caseId, req.body.org_id, user?.sub || DEV_USER_ID, name, storage_path, bucket_id || 'case-documents', content_type, size_bytes || 0, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Document create error:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

export default router;
