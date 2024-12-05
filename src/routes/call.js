// src/routes/call.js
import { config } from '../config/index.js';
import { setupWebSocketHandler } from '../services/speech/index.js';
import { logger } from '../utils/logger.js';
import { validateTwilioRequest } from '../middleware/validate-twilio.js';
import fs from 'fs';

export async function callRoutes(fastify) {
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
                    <Say voice="Polly.Mathieu" >Welcome to the Voice Assistant Service.</Say>
                    <Connect>
                        <Stream url="wss://${request.headers.host}/media-stream" />
                    </Connect>
                </Response>`;
            logger.info({ twimlResponse }, 'twiml response');
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
            setupWebSocketHandler(connection, req).catch(error => {
                logger.error('Error in WebSocket handler:', error);
                connection.socket.close();
            });
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

    fastify.get('/.well-known/pki-validation/01101B418C41258A67852E0C58376C9C.txt', (req, res) => {
        res.type('text/plain');
        console.log(fs);
        fs.readFile('01101B418C41258A67852E0C58376C9C.txt', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                return res.status(500).send('Error reading file');
            }
            res.send(data);
        });
    });
}
