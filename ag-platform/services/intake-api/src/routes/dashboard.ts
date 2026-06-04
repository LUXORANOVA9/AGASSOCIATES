import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getCachedNOIDashboard, cacheNOIDashboard } from '../services/redis.service';

// Mock DB function
async function fetchNOIDataFromDB(orgId: string) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        total_active_noi: 42,
        critical_count: 5,
        cases: [
          { case_id: '1', days_remaining: 3, bank_name: 'HDFC' }
        ]
      });
    }, 300);
  });
}

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.withTypeProvider<ZodTypeProvider>().get(
    '/noi',
    {
      schema: {
        querystring: z.object({
          org_id: z.string().uuid()
        })
      }
    },
    async (request, reply) => {
      const { org_id } = request.query;

      try {
        // 1. Check Redis Cache
        const cachedData = await getCachedNOIDashboard(org_id);

        if (cachedData) {
          fastify.log.info({ org_id }, 'Serving NOI Dashboard from Redis');
          return {
            source: 'cache',
            data: cachedData,
          };
        }

        // 2. Fetch from DB
        fastify.log.info({ org_id }, 'Cache miss. Fetching from DB.');
        const dbData = await fetchNOIDataFromDB(org_id);

        // 3. Update Cache
        await cacheNOIDashboard(org_id, dbData);

        return {
          source: 'database',
          data: dbData,
        };
      } catch (err) {
        fastify.log.error({ err, org_id }, 'NOI dashboard request failed');
        return reply.code(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}
