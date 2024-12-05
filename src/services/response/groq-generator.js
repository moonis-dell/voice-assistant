// src/services/response/groq-generator.js
import { BaseResponseGenerator } from './base.js';
import { BasicResponseGenerator } from './basic-generator.js';
import { logger } from '../../utils/logger.js';

export class GroqResponseGenerator extends BaseResponseGenerator {
    constructor(config) {
        super();
        this.apiUrl = 'http://localhost:5000/query';
        this.config = config;
        this.conversationHistory = new Map();
        this.basicGenerator = new BasicResponseGenerator();
    }

    async generateResponse(transcript, sessionId) {
        const startTime = process.hrtime();
        try {
            // Build URL with query parameters
            const url = new URL(this.apiUrl);
            url.searchParams.append('STT_output', transcript);
            url.searchParams.append('callid', sessionId || 'default');

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'text/plain'
                }
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const generatedResponse = await response.text();

            const endTime = process.hrtime(startTime);
            const latencyMs = endTime[0] * 1000 + endTime[1] / 1000000;
            console.log()
            console.log()
            console.log('=========================================================================================')
            console.log('=========================================================================================')
            logger.info({
                type: 'local_api_latency',
                latency: latencyMs,
                sessionId,
                transcript,
                response: generatedResponse
            });           
            console.log('=========================================================================================')
            console.log('=========================================================================================')
            console.log()
            console.log()
            return generatedResponse; //|| this.getFallbackResponse(transcript);

        } catch (error) {
            logger.error('Local API error:', error);
            //return this.getFallbackResponse(transcript);
        }
    }

    
}