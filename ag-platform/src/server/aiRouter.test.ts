import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import aiRouter from './aiRouter';

// Mock Resend before importing aiRouter (which uses it)
const mockSend = vi.fn().mockResolvedValue({ data: { id: 'test_id' }, error: null });

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => {
      return {
        emails: {
          send: mockSend
        }
      };
    })
  };
});

describe('aiRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
  });

  describe('POST /send-email', () => {
    it('should sanitize the email body to prevent HTML injection', async () => {
      const maliciousBody = 'Hello\n<script>alert("xss")</script>\nWorld';

      // We can manually invoke the router middleware by simulating req, res, next
      // However, expressing a full router test is complex without supertest.
      // Let's create a minimal mock app and test it with fetch or just by calling the handler directly.

      // Get the send-email route handler
      const routes = aiRouter.stack;
      const sendEmailRoute = routes.find((layer: any) => layer.route && layer.route.path === '/send-email');
      expect(sendEmailRoute).toBeDefined();

      const handler = sendEmailRoute.route.stack[0].handle;

      const req: any = {
        body: {
          to: 'test@example.com',
          subject: 'Test Subject',
          body: maliciousBody
        }
      };

      const res: any = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis()
      };

      await handler(req, res);

      expect(mockSend).toHaveBeenCalledWith({
        from: 'AgAssociates <noreply@resend.dev>',
        to: ['test@example.com'],
        subject: 'Test Subject',
        html: 'Hello<br/>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;<br/>World'
      });

      expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'test_id' } });
    });
  });
});
