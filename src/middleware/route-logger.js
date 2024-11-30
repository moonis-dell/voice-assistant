// src/middleware/route-logger.js
import { logger } from '../utils/logger.js';

export async function routeLogger(request, reply) {
    const startTime = process.hrtime();

    reply.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        logger.info({
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            duration: `${duration.toFixed(2)}ms`,
            userAgent: request.headers['user-agent'],
            ip: request.ip
        });
    });
}


