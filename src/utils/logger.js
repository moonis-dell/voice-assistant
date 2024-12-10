// src/utils/logger.js
import pino from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
    level: config.logging.level,
    transport: config.logging.prettyPrint ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined,
    // base: {
    //     env: process.env.NODE_ENV,
    //     instance: process.env.EC2_INSTANCE_ID || 'unknown'
    // }
});