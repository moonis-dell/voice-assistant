// src/services/speech/index.js
import { AudioTransformer } from '../audio/transformer.js';
import { TranscribeService } from '../transcribe/index.js';
import { TTSService } from '../tts/index.js';
import { ResponseService } from '../response/index.js';
import { TranscriptService } from '../dynamodb/index.js';
import { SpeechManager } from './smanager.js';
import { WebSocketHandler } from './wshandler.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

/**
 * Sets up the WebSocket handler with all required services
 * @param {WebSocket} connection - WebSocket connection
 * @param {Object} req - Request object
 * @returns {Promise<WebSocketHandler>}
 */
export async function setupWebSocketHandler(connection, req, config) {
    try {
        // Initialize all required services
        const services = {
            audioTransformer: new AudioTransformer(config),
            transcribeService: new TranscribeService(config),
            ttsService: new TTSService(),
            responseService: new ResponseService(config),
            transcriptService: new TranscriptService(config),
            cleanup: async () => {
                logger.info('Cleaning up services');
                // Add any specific cleanup logic here
            }
        };

        const speechManager = new SpeechManager(config);
        const wsHandler = new WebSocketHandler(connection.socket, speechManager, services);

        logger.info('WebSocket handler setup complete');
        return wsHandler;
    } catch (error) {
        logger.error({ error }, 'Error setting up WebSocket handler');
        throw error;
    }
}

export { SpeechManager, WebSocketHandler };