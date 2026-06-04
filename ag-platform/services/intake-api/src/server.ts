import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { connectRedis } from './services/redis.service';
import webhookRoutes from './routes/webhook';
import dashboardRoutes from './routes/dashboard';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

const fastify = Fastify({
  logger: isProd
    ? true
    : {
        transport: {
          target: 'pino-pretty',
        },
      },
}).withTypeProvider<ZodTypeProvider>();

// Set up Zod validation
fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

async function start() {
  try {
    await fastify.register(cors);
    
    // Connect to Redis
    await connectRedis();

    // Register Routes
    await fastify.register(webhookRoutes, { prefix: '/api/v1/webhook' });
    await fastify.register(dashboardRoutes, { prefix: '/api/v1/dashboard' });

    // Health Check (verifies Redis connectivity)
    fastify.get('/health', async (_req, reply) => {
      try {
        // Imported here to avoid a circular reference at module load.
        const { redisClient } = await import('./services/redis.service');
        await redisClient.ping();
        return { status: 'healthy' };
      } catch (err) {
        fastify.log.error({ err }, 'Health check failed');
        return reply.code(503).send({ status: 'unhealthy', error: 'redis unreachable' });
      }
    });

    const parsedPort = Number(process.env.PORT);
    const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
