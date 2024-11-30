// src/services/transcribe/index.js
import { TranscribeClient } from './client.js';
import { logger } from '../../utils/logger.js';

export class TranscribeService {
    constructor(config) {
        try {
            this.client = new TranscribeClient(config);
        } catch (error) {
            logger.error('Failed to initialize TranscribeClient:', error);
            throw error;
        }
    }

    async startStream(audioStream) {
        try {
            if (!audioStream) {
                throw new Error('Audio stream not provided');
            }
            return await this.client.startStream(audioStream);
        } catch (error) {
            logger.error('Failed to start transcription:', error);
            throw error;
        }
    }
}