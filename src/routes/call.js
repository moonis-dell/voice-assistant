// src/routes/call.js
import { config } from '../config/index.js';
import { setupWebSocketHandler } from '../services/audio/index.js';
import { logger } from '../utils/logger.js';
import { validateTwilioRequest } from '../middleware/validate-twilio.js';

export async function callRoutes(fastify) {
    //fastify.addHook('preHandler', validateTwilioRequest);
    // Validate incoming call request
    const callSchema = {
        body: {
            type: 'object',
            required: ['CallSid'],
            properties: {
                CallSid: { type: 'string' },
                From: { type: 'string' },
                To: { type: 'string' },
                Direction: { type: 'string' }
            }
        }
    };

    // Handle incoming Twilio voice calls
    fastify.post('/incoming-call', async (request, reply) => {
        try {
            const { CallSid } = request.body;
            logger.info({ CallSid }, 'Incoming call received');

            const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                <Response>
                    <Say>Welcome to the Voice Assistant Service.</Say>
                    <Connect>
                        <Stream url="ws://stack--appli-78a3kyaajsj9-1756093919.us-east-1.elb.amazonaws.com/media-stream" />
                    </Connect>
                </Response>`;
            
            reply.type('text/xml').send(twimlResponse);
            
            logger.info({ CallSid }, 'TwiML response sent');
        } catch (error) {
            logger.error('Error handling incoming call:', error);
            throw error;
        }
    });

    // Status callback endpoint
    fastify.post('/status', async (request, reply) => {
        try {
            const { CallSid, CallStatus } = request.body;
            logger.info({ CallSid, CallStatus }, 'Call status update');
            
            reply.send({ status: 'received' });
        } catch (error) {
            logger.error('Error handling status callback:', error);
            throw error;
        }
    });

    // WebSocket endpoint for media streaming
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        try {
            logger.info('New WebSocket connection established');
            setupWebSocketHandler(connection, req);
        } catch (error) {
            logger.error('Error setting up WebSocket handler:', error);
            connection.socket.close();
        }
    });

    // Simple test endpoint
    fastify.get('/', async (request, reply) => {
        return { 
            message: 'Voice assistant service is running',
            timestamp: new Date().toISOString()
        };
    });
}
