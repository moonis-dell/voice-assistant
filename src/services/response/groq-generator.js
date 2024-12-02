// src/services/response/groq-generator.js
import { BaseResponseGenerator } from './base.js';
import { BasicResponseGenerator } from './basic-generator.js';
import Groq from 'groq-sdk';
import { logger } from '../../utils/logger.js';

export class GroqResponseGenerator extends BaseResponseGenerator {
    constructor(config) {
        super();
        this.client = new Groq({
            apiKey: config.groq.apiKey
        });
        this.config = config;
        this.conversationHistory = new Map();
        this.basicGenerator = new BasicResponseGenerator();
        
        // Optimized system prompt for shorter responses
        this.systemPrompt = `You are a concise FNOL agent collecting accident info.
Rules:
- One short question per response
- Max 10-15 words per response
- No pleasantries or explanations
- Just ask for: name, policy number, car details, accident details, or location
Example responses:
"What is your full name?"
"Please provide your policy number."
"Where did the accident occur?"`;
    }

    async generateResponse(transcript, sessionId = null) {
        const startTime = process.hrtime();
        try {
            const context = sessionId ?
                this.getConversationHistory(sessionId).slice(-2) : // Reduced context
                [];

            const completion = await this.client.chat.completions.create({
                model: this.config.groq.model,
                messages: [
                    {
                        role: "system",
                        content: this.systemPrompt
                    },
                    ...context.map(exchange => ([
                        { role: "user", content: exchange.user },
                        { role: "assistant", content: exchange.assistant }
                    ])).flat(),
                    {
                        role: "user",
                        content: transcript
                    }
                ],
                temperature: 0.3, // Lower temperature for more focused responses
                max_tokens: 25,   // Reduced max tokens
                top_p: 1
            });

            const endTime = process.hrtime(startTime);
            const latencyMs = endTime[0] * 1000 + endTime[1] / 1000000;

            logger.info({
                type: 'groq_api_latency',
                latency: latencyMs,
                sessionId,
                responseLength: completion.choices[0]?.message?.content.length
            });

            const response = completion.choices[0]?.message?.content ||
                this.getFallbackResponse(transcript);

            if (sessionId) {
                this.storeExchange(sessionId, transcript, response);
            }

            return response;

        } catch (error) {
            logger.error('Groq API error:', error);
            return this.getFallbackResponse(transcript);
        }
    }

    getFallbackResponse(transcript) {
        const basicResponses = {
            name: "What is your full name?",
            policy: "What's your policy number?",
            car: "What's the make and model of your car?",
            accident: "When did the accident occur?",
            location: "Where did the accident happen?"
        };

        // Return a random basic response
        const responses = Object.values(basicResponses);
        return responses[Math.floor(Math.random() * responses.length)];
    }

    getConversationHistory(sessionId) {
        const history = this.conversationHistory.get(sessionId) || [];
        return history.slice(-2); // Keep only last 2 exchanges
    }

    storeExchange(sessionId, userInput, assistantResponse) {
        const history = this.conversationHistory.get(sessionId) || [];
        history.push({
            user: userInput,
            assistant: assistantResponse,
            timestamp: new Date().toISOString()
        });

        if (history.length > 5) { // Reduced history size
            history.shift();
        }

        this.conversationHistory.set(sessionId, history);
    }

    clearHistory(sessionId) {
        this.conversationHistory.delete(sessionId);
    }
}