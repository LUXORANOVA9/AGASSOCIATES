import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { intakePayloadSchema } from '../schemas/intake.schema';
import { invalidateNOICache, redisClient } from '../services/redis.service';
import { createCase, findOnDutyStaff, getOrganizationByBank } from '../services/supabase.service';
import { broadcastOtp } from '../services/telegram.service';

export default async function webhookRoutes(fastify: FastifyInstance) {
  const typedFastify = fastify.withTypeProvider<ZodTypeProvider>();

  // 1. Bank Intake Webhook (Agent 1)
  typedFastify.post(
    '/bank-intake',
    {
      schema: {
        body: intakePayloadSchema,
      },
    },
    async (request, reply) => {
      const validatedData = request.body;

      fastify.log.info({ bank_name: validatedData.bank_name }, 'Intake webhook received');

      // Resolve Org ID from Bank Name
      const orgId = await getOrganizationByBank(validatedData.bank_name);
      
      if (!orgId) {
        return reply.status(404).send({ status: 'error', message: 'Bank partner organization not found' });
      }

      // Create Case in Supabase — starts at RECEIVED lifecycle, DOCUMENTS_RECEIVED NOI sub-process
      const newCase = await createCase({
        org_id: orgId,
        bank_name: validatedData.bank_name,
        case_type: 'NOI',
        case_status: 'RECEIVED',
        noi_status: 'DOCUMENTS_RECEIVED',
      });
      
      // Invalidate cache for this org
      await invalidateNOICache(orgId);

      return reply.status(200).send({
        status: 'success',
        message: 'Intake processed and case created',
        data: {
          case_id: newCase.id,
          received_timestamp: validatedData.received_timestamp || new Date().toISOString()
        }
      });
    }
  );

  // 2. OTP Webhook (For RPA Executor)
  // Receives OTPs from WhatsApp/Email services and routes them to the Executor
  typedFastify.post(
    '/otp-receive',
    {
      schema: {
        body: z.object({
          case_id: z.string().uuid(),
          otp_code: z.string().min(4).max(8),
          source: z.string()
        })
      }
    },
    async (request, reply) => {
      const { case_id, otp_code, source } = request.body;
      
      fastify.log.info({ case_id, source }, 'OTP Received for RPA processing');

      // Store in Redis with a 5-minute TTL
      // Key format: otp:case_id
      await redisClient.setEx(`otp:${case_id}`, 300, otp_code);
      
      return reply.status(200).send({ status: 'success', message: 'OTP captured and stored in Redis' });
    }
  );

  // 3. SMS Webhook (for OTP Bridge)
  // Receives incoming SMS from Android Forwarder / Twilio / SMS Gateway.
  // Accepts POST (JSON) or GET (query params) so the user can paste a
  // single URL into pppscn/SmsForwarder without any body template.
  //
  // org_id is optional. If absent, the sender phone is auto-resolved
  // via a Redis mapping (forwarder_phone:{phone} → org_id). Admin can
  // register phones via POST /api/v1/admin/register-forwarder.

  async function handleSmsIncoming(
    text: string,
    sender: string | undefined,
    orgId: string | undefined,
    bankId: string | undefined,
    fastify: FastifyInstance,
  ) {
    fastify.log.info({ from: sender, preview: text.slice(0, 60), org_id: orgId }, 'SMS received');

    // Resolve org_id from sender phone if not provided
    if (!orgId && sender) {
      const mappedOrgId = await redisClient.get(`forwarder_phone:${sender}`);
      if (mappedOrgId) {
        orgId = mappedOrgId;
        fastify.log.info({ from: sender, org_id: orgId }, 'Org resolved from sender phone');
      }
    }

    // Parse OTP code (4-8 digits)
    const otpMatch = text.match(/\b(\d{4,8})\b/);
    if (!otpMatch) {
      return { status: 'skipped', reason: 'no OTP found in SMS' };
    }
    const otpCode = otpMatch[1];

    // Detect portal from SMS text
    const portalMap: Record<string, RegExp> = {
      gras: /\bGRAS\b/i,
      igr: /\bIGR\b/i,
      cersai: /\bCERSAI\b/i,
      sbi: /\bSBI\b/i,
      noc: /\bNOC\b/i,
    };
    let detectedPortal = 'any';
    for (const [portal, pattern] of Object.entries(portalMap)) {
      if (pattern.test(text)) {
        detectedPortal = portal;
        break;
      }
    }

    // Store in Redis for Telegram bot to match against pending requests
    await redisClient.rPush(
      `otp_incoming:${detectedPortal}`,
      JSON.stringify({
        otp: otpCode,
        sender: sender || 'unknown',
        received_at: new Date().toISOString(),
        sms_preview: text.slice(0, 100),
      })
    );
    await redisClient.expire(`otp_incoming:${detectedPortal}`, 600);

    if (detectedPortal !== 'any') {
      await redisClient.rPush(
        `otp_incoming:any`,
        JSON.stringify({
          otp: otpCode,
          sender: sender || 'unknown',
          received_at: new Date().toISOString(),
          sms_preview: text.slice(0, 100),
        })
      );
      await redisClient.expire(`otp_incoming:any`, 600);
    }

    // Publish to Redis channel for the Telegram bot (group ops room)
    await redisClient.publish('otp:incoming', JSON.stringify({
      otp: otpCode,
      portal: detectedPortal,
      sender: sender || 'unknown',
      org_id: orgId ?? null,
      bank_id: bankId ?? null,
    }));

    // Push to on-duty staff via Telegram (only if org_id was available)
    let pushResults = { ok: 0, failed: 0, total: 0 };
    if (orgId) {
      try {
        const staff = await findOnDutyStaff(orgId, bankId ?? null);
        if (staff.length > 0) {
          const results = await broadcastOtp(staff, otpCode, detectedPortal, text);
          pushResults = {
            ok: results.filter((r) => r.ok).length,
            failed: results.filter((r) => !r.ok).length,
            total: results.length,
          };
          fastify.log.info({ org_id: orgId, pushResults }, 'OTP pushed to on-duty staff');
        } else {
          fastify.log.warn({ org_id: orgId }, 'No on-duty staff with Telegram binding');
        }
      } catch (err) {
        fastify.log.error({ err, org_id: orgId }, 'Failed to push OTP to staff');
      }
    } else {
      fastify.log.warn('No org_id — OTP is in Redis only (no Telegram push)');
    }

    return { status: 'success', otp: otpCode, portal: detectedPortal, push: pushResults };
  }

  // POST /sms-incoming — JSON body (existing clients)
  typedFastify.post(
    '/sms-incoming',
    {
      schema: {
        body: z.object({
          text: z.string(),
          from: z.string().optional(),
          sent_timestamp: z.string().optional(),
          org_id: z.string().uuid().optional(),
          bank_id: z.string().uuid().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { text, from, org_id, bank_id } = request.body;
      const result = await handleSmsIncoming(text, from, org_id, bank_id, fastify);
      return reply.status(200).send(result);
    }
  );

  // GET /sms-incoming — query params (pppscn/SmsForwarder single-URL mode)
  //
  // Accepts two naming conventions for parameters:
  //   {sms.sender} style —  ?sender=...&text=...&time=...
  //   pppscn auto-append — ?from=...&content=...&timestamp=...  (webParams empty)
  //
  // URL examples:
  //   https://intake.agassociates.in/api/v1/webhook/sms-incoming?sender={sms.sender}&text={sms.body}&time={sms.time}
  //   https://intake.agassociates.in/api/v1/webhook/sms-incoming  (auto-appends from, content, timestamp)
  fastify.get('/sms-incoming', async (request, reply) => {
    const q = request.query as Record<string, string | undefined>;
    const text = q.text || q.content;
    const sender = q.sender || q.from;
    if (!text) {
      return reply.status(400).send({ error: 'text or content param is required' });
    }
    const result = await handleSmsIncoming(text, sender, q.org_id, q.bank_id, fastify);
    return reply.status(200).send(result);
  });

  // Centralized Error Handling
  fastify.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.status(400).send({
        status: 'error',
        message: 'Validation failed',
        errors: error.validation
      });
    }
    
    fastify.log.error(error);
    return reply.status(500).send({
      status: 'error',
      message: 'Internal server error'
    });
  });
}
