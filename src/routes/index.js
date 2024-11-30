// src/routes/index.js
import { healthRoutes } from './health.js';
import { callRoutes } from './call.js';
import { logger } from '../utils/logger.js';

export async function setupRoutes(app) {
    try {
        // Register all route groups
        await app.register(healthRoutes, { prefix: '/health' });
        await app.register(callRoutes);

        // 404 handler
        app.setNotFoundHandler((request, reply) => {
            reply.code(404).send({
                error: 'Not Found',
                message: `Route ${request.method}:${request.url} not found`
            });
        });

    } catch (error) {
        logger.error('Error setting up routes:', error);
        throw error;
    }
}




