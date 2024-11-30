// src/services/response/groq-generator.js
import { BaseResponseGenerator } from './base.js';
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
        this.systemPrompt = `You are an empathetic and professional First Notice of Loss (FNOL) agent for car insurance claims 
        efficiently gathering essential information about their accident. 
        Collect the following information:
      - Full name
      - Policy number
      - Car details
      - Accident details
      - Location
      Ask one question at a time and be supportive.`;
    }

    async generateResponse(transcript, sessionId = null) {
        try {
            const context = sessionId ?
                this.getConversationHistory(sessionId) :
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
                temperature: this.config.groq.temperature,
                max_tokens: this.config.groq.maxTokens,
                top_p: 1
            });

            const response = completion.choices[0]?.message?.content ||
                this.getFallbackResponse(transcript);

            if (sessionId) {
                this.storeExchange(sessionId, transcript, response);
            }

            return response;

        } catch (error) {
            logger.error('GROQ response generation error:', error);
            return this.getFallbackResponse(transcript);
        }
    }

    getFallbackResponse(transcript) {
        const basic = new BasicResponseGenerator();
        return basic.generateResponse(transcript);
    }

    getConversationHistory(sessionId) {
        const history = this.conversationHistory.get(sessionId) || [];
        return history.slice(-5); // Last 5 exchanges
    }

    storeExchange(sessionId, userInput, assistantResponse) {
        const history = this.conversationHistory.get(sessionId) || [];
        history.push({
            user: userInput,
            assistant: assistantResponse,
            timestamp: new Date().toISOString()
        });

        if (history.length > 10) {
            history.shift();
        }

        this.conversationHistory.set(sessionId, history);
    }

    clearHistory(sessionId) {
        this.conversationHistory.delete(sessionId);
    }
}
