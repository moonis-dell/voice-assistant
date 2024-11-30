// src/routes/health.js
import { logger } from '../utils/logger.js';

export async function healthRoutes(fastify) {
    fastify.get('/', async (request, reply) => {
        try {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage()
            };
        } catch (error) {
            logger.error('Health check error:', error);
            throw error;
        }
    });
}