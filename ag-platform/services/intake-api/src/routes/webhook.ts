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

      // Create Case in Supabase
      const newCase = await createCase({
        org_id: orgId,
        bank_name: validatedData.bank_name,
        case_type: 'NOI', // Defaulting to NOI for demonstration
        status: 'Pending Intake'
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
