import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { intakePayloadSchema } from '../schemas/intake.schema';
import { invalidateNOICache, redisClient } from '../services/redis.service';
import { createCase, getOrganizationByBank } from '../services/supabase.service';

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
  // Receives incoming SMS from Android Forwarder / Twilio / SMS Gateway
  typedFastify.post(
    '/sms-incoming',
    {
      schema: {
        body: z.object({
          text: z.string(),
          from: z.string().optional(),
          sent_timestamp: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { text, from } = request.body;
      fastify.log.info({ from, preview: text.slice(0, 60) }, 'SMS received');

      // Parse OTP code (4-8 digits)
      const otpMatch = text.match(/\b(\d{4,8})\b/);
      if (!otpMatch) {
        return reply.status(200).send({ status: 'skipped', reason: 'no OTP found in SMS' });
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
      // Key: otp_incoming:{portal} — append to list for FIFO matching
      await redisClient.rPush(
        `otp_incoming:${detectedPortal}`,
        JSON.stringify({
          otp: otpCode,
          sender: from || 'unknown',
          received_at: new Date().toISOString(),
          sms_preview: text.slice(0, 100),
        })
      );
      await redisClient.expire(`otp_incoming:${detectedPortal}`, 600); // 10 min TTL

      // Also store in any-queue for fallback matching
      if (detectedPortal !== 'any') {
        await redisClient.rPush(
          `otp_incoming:any`,
          JSON.stringify({
            otp: otpCode,
            sender: from || 'unknown',
            received_at: new Date().toISOString(),
            sms_preview: text.slice(0, 100),
          })
        );
        await redisClient.expire(`otp_incoming:any`, 600);
      }

      // Publish event to Redis channel for real-time notification
      await redisClient.publish('otp:incoming', JSON.stringify({
        otp: otpCode,
        portal: detectedPortal,
        sender: from || 'unknown',
      }));

      return reply.status(200).send({
        status: 'success',
        otp: otpCode,
        portal: detectedPortal,
      });
    }
  );

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
