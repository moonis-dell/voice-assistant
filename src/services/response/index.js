// src/services/response/index.js
import { ResponseGeneratorFactory } from './factory.js';
import { logger } from '../../utils/logger.js';

export class ResponseService {
    constructor(config) {
        this.generator = ResponseGeneratorFactory.createGenerator(config);
        logger.info(`Using ${config.response.type || 'basic'} response generator`);
        //logger.info(this.generator)
    }

    async generateResponse(transcript, sessionId = null) {
        return await this.generator.generateResponse(transcript, sessionId);
    }

    clearHistory(sessionId) {
        this.generator.clearHistory(sessionId);
    }
}