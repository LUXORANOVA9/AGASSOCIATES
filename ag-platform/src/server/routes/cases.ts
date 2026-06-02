
import express from 'express';
import jwt from 'jsonwebtoken';
import { CaseService } from '../services/caseService.ts';

const router = express.Router();
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

const DEV_USER_ID = '28a4eb7d-162c-4161-817d-20c30ffa5f46';

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

router.use('/cases', (req, _res, next) => { setUser(req); next(); });

router.get('/cases', async (_req, res) => {
  try {
    const cases = await CaseService.getActiveCases();
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

router.get('/cases/:id', async (req, res) => {
  try {
    const kase = await CaseService.getCaseById(req.params.id);
    if (!kase) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    res.json(kase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

router.get('/cases/:id/timeline', async (req, res) => {
  try {
    const entries = await CaseService.getCaseTimeline(req.params.id);
    res.json(entries);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

router.post('/cases', async (req, res) => {
  try {
    const { borrower_name, org_id, bank_id, case_type } = req.body;
    if (!borrower_name || !org_id || !bank_id || !case_type) {
      res.status(400).json({ error: 'Missing required fields: borrower_name, org_id, bank_id, case_type' });
      return;
    }
    const newCase = await CaseService.createCase(req.body);
    res.status(201).json(newCase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.put('/cases/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const userId = req.body.userId || (req as any).user?.sub || DEV_USER_ID;
    await CaseService.updateStatus(req.params.id, status, userId, notes);
    
    if (status === 'IN_PROGRESS') {
      const caseDetails = await CaseService.getCaseById(req.params.id);
      if (caseDetails) {
        const authHeader = req.headers.authorization || '';
        const aiBackend = process.env.AI_BACKEND_URL || 'http://127.0.0.1:8001';
        fetch(`${aiBackend}/api/generate-agreement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader
          },
          body: JSON.stringify({
            raw_input: `Case ${caseDetails.case_number} for ${caseDetails.borrower_name}. Type: ${caseDetails.case_type}. Loan Amount: ${caseDetails.loan_amount}. Please draft necessary legal documents.`,
            sender: userId || 'system'
          })
        }).catch(err => console.error("Failed to trigger AI pipeline:", err));
      }
    }
    
    res.status(200).json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Frontend AdvisorCockpit calls PATCH /api/cases/:id with { status }
router.patch('/cases/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }
    const userId = req.headers['x-user-id'] as string || (req as any).user?.sub || DEV_USER_ID;
    await CaseService.updateStatus(req.params.id, status, userId, notes || 'Status updated via pipeline');
    const updatedCase = await CaseService.getCaseById(req.params.id);
    res.json(updatedCase);
  } catch (error: any) {
    console.error('PATCH case error:', error);
    console.error('PATCH req.user:', (req as any).user);
    console.error('PATCH userId used:', userId);
    res.status(500).json({ error: error.message || 'Failed to update case' });
  }
});

export default router;
