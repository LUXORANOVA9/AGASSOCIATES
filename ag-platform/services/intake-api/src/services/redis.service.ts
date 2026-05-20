import { createClient } from 'redis';
import pino from 'pino';

const logger = pino();

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error({ err }, 'Redis Client Error'));
redisClient.on('connect', () => logger.info('Connected to Redis'));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

const NOI_CACHE_PREFIX = 'noi_dashboard:';
const CACHE_TTL = 900; // 15 minutes in seconds

export async function getCachedNOIDashboard(orgId: string): Promise<any | null> {
  try {
    const data = await redisClient.get(`${NOI_CACHE_PREFIX}${orgId}`);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error({ err, orgId }, 'Error getting cached NOI dashboard');
    return null; // Fail open to allow DB fallback
  }
}

export async function cacheNOIDashboard(orgId: string, data: any): Promise<void> {
  try {
    await redisClient.setEx(`${NOI_CACHE_PREFIX}${orgId}`, CACHE_TTL, JSON.stringify(data));
  } catch (err) {
    logger.error({ err, orgId }, 'Error setting cached NOI dashboard');
  }
}

export async function invalidateNOICache(orgId: string): Promise<void> {
  try {
    await redisClient.del(`${NOI_CACHE_PREFIX}${orgId}`);
    logger.info({ orgId }, 'Invalidated NOI dashboard cache');
  } catch (err) {
    logger.error({ err, orgId }, 'Error invalidating NOI dashboard cache');
  }
}
