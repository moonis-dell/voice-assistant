// src/middleware/security.js
import rateLimit from '@fastify/rate-limit';
import { logger } from '../utils/logger.js';
import {config} from '../config/index.js'

export async function setupSecurity(app) {
    // Rate limiting
    await app.register(rateLimit, {
        max: 100,
        timeWindow: '1 minute',
        allowList: ['127.0.0.1'],
        hook: 'preHandler',
        errorResponseBuilder: (request, context) => ({
            code: 429,
            error: 'Too Many Requests',
            message: `Rate limit exceeded, retry in ${context.after}`,
            expiresIn: context.after
        })
    });

    // Security headers
    app.addHook('onRequest', async (request, reply) => {
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('X-XSS-Protection', '1; mode=block');
    });

    // Payload size limits
    app.addHook('onRequest', async (request) => {
        const contentLength = parseInt(request.headers['content-length'] || 0);
        if (contentLength > config.security.maxPayloadSize) {
            logger.warn({
                msg: 'Payload size exceeded',
                size: contentLength,
                limit: config.security.maxPayloadSize
            });
            throw new Error('Payload too large');
        }
    });

    // Error handling
    app.setErrorHandler((error, request, reply) => {
        logger.error(error);
        
        const statusCode = error.statusCode || 500;
        const response = {
            error: statusCode === 500 ? 'Internal Server Error' : error.message,
            statusCode
        };

        if (process.env.NODE_ENV === 'development') {
            response.stack = error.stack;
        }

        reply.status(statusCode).send(response);
    });
}
