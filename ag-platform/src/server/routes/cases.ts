
import express from 'express';
import { CaseService } from '../services/caseService.ts';

const router = express.Router();

router.get('/cases', async (_req, res) => {
  try {
    const cases = await CaseService.getActiveCases();
    res.json(cases);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

router.post('/cases', async (req, res) => {
  try {
    const newCase = await CaseService.createCase(req.body);
    res.status(201).json(newCase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create case' });
  }
});

router.put('/cases/:id/status', async (req, res) => {
  try {
    const { status, notes, userId } = req.body;
    await CaseService.updateStatus(req.params.id, status, userId || '00000000-0000-0000-0000-000000000000', notes);
    
    // P3: Pipeline Integration
    // Trigger AI pipeline when a case moves to IN_PROGRESS
    if (status === 'IN_PROGRESS') {
      const caseDetails = await CaseService.getCaseById(req.params.id);
      if (caseDetails) {
        // Forward the frontend's JWT token to the AI Backend for P2 Auth Unification
        const authHeader = req.headers.authorization || '';
        
        // Asynchronously trigger the AI document generation
        fetch('http://127.0.0.1:8001/api/generate-agreement', {
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

export default router;
