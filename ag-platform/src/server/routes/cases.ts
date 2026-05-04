
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
    res.status(200).json({ message: 'Status updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
