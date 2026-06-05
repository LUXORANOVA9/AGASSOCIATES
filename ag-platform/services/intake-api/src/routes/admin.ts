import { FastifyInstance } from 'fastify';
import { redisClient } from '../services/redis.service';

export default async function adminRoutes(fastify: FastifyInstance) {

  // Register a phone number → org_id mapping so the SMS forwarder
  // user doesn't need to include org_id in the URL or body template.
  // Usage: POST /api/v1/admin/register-forwarder { "phone": "+919876543210", "org_id": "uuid" }
  fastify.post('/register-forwarder', async (request, reply) => {
    const { phone, org_id } = request.body as Record<string, string | undefined>;
    if (!phone || !org_id) {
      return reply.status(400).send({ error: 'phone and org_id required' });
    }
    await redisClient.set(`forwarder_phone:${phone}`, org_id);
    fastify.log.info({ phone, org_id }, 'Forwarder phone registered');
    return { status: 'registered', phone, org_id };
  });

  // Remove a phone number mapping.
  fastify.delete('/register-forwarder', async (request, reply) => {
    const { phone } = request.query as Record<string, string | undefined>;
    if (!phone) {
      return reply.status(400).send({ error: 'phone query param required' });
    }
    await redisClient.del(`forwarder_phone:${phone}`);
    return { status: 'removed', phone };
  });

  // List all registered forwarder phones (for debugging).
  fastify.get('/forwarders', async (_request, reply) => {
    const keys = await redisClient.keys('forwarder_phone:*');
    if (keys.length === 0) {
      return { forwarders: [] };
    }
    const values = await redisClient.mGet(keys);
    const forwarders = keys.map((key, i) => ({
      phone: key.replace('forwarder_phone:', ''),
      org_id: values[i],
    }));
    return { forwarders };
  });
}
