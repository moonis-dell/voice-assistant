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

export async function setupWebSocketHandler(connection, req) {
    try {
        const services = {
            audioTransformer: new AudioTransformer(config),
            transcribeService: new TranscribeService(config),
            ttsService: new TTSService(),
            responseService: new ResponseService(config),
            transcriptService: new TranscriptService(config),
            cleanup: async () => {
                logger.info('Cleaning up services');
            }
        };

        const speechManager = new SpeechManager(config);
        const wsHandler = new WebSocketHandler(connection.socket, speechManager, services);

        console.log(`[${new Date().toISOString().split('T')[1].slice(0, -1)}] WebSocket handler setup complete`);
        return wsHandler;
    } catch (error) {
        console.error(`[${new Date().toISOString().split('T')[1].slice(0, -1)}] Error setting up WebSocket handler:`, error);
        logger.error('Error setting up WebSocket handler:', error);
        throw error;
    }
}

export { SpeechManager, WebSocketHandler };