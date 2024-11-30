// src/services/response/factory.js
import { BasicResponseGenerator } from './basic-generator.js';
import { GroqResponseGenerator } from './groq-generator.js';
import { logger } from '../../utils/logger.js';

export class ResponseGeneratorFactory {
    static createGenerator(config) {
        const type = config.response.type || 'basic';
        
        switch (type.toLowerCase()) {
            case 'basic':
                return new BasicResponseGenerator();
            case 'groq':
                if (!config.groq?.apiKey) {
                    logger.warn('GROQ API key not found, falling back to basic generator');
                    return new BasicResponseGenerator();
                }
                return new GroqResponseGenerator(config);
            default:
                logger.warn(`Unknown response generator type: ${type}, using basic`);
                return new BasicResponseGenerator();
        }
    }
}