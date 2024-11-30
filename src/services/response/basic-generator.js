// src/services/response/basic-generator.js
import { BaseResponseGenerator } from './base.js';
import { logger } from '../../utils/logger.js';

export class BasicResponseGenerator extends BaseResponseGenerator {
    constructor() {
        super();
        this.responses = {
            greeting: [
                "Hello! How can I help you today?",
                "Hi there! What can I do for you?",
                "Welcome! How may I assist you?"
            ],
            acknowledgment: [
                "I understand what you're saying.",
                "Got it, I follow you.",
                "I hear you clearly.",
                "I understand your point."
            ],
            confirmation: [
                "Sure, I can help with that.",
                "Let me assist you with that.",
                "I'll help you with this."
            ],
            clarification: [
                "Could you please elaborate?",
                "Would you mind explaining more?",
                "Can you provide more details?"
            ],
            closing: [
                "Thank you for talking with me.",
                "Is there anything else you need?",
                "Let me know if you need more help."
            ]
        };
    }

    async generateResponse(transcript) {
        try {
            const lowercaseTranscript = transcript.toLowerCase();
            
            if (lowercaseTranscript.includes('hello') || 
                lowercaseTranscript.includes('hi') || 
                lowercaseTranscript.includes('hey')) {
                return this.getRandomResponse('greeting');
            }

            if (lowercaseTranscript.includes('?') || 
                lowercaseTranscript.includes('what') || 
                lowercaseTranscript.includes('how') || 
                lowercaseTranscript.includes('why')) {
                return this.getRandomResponse('clarification');
            }

            if (lowercaseTranscript.includes('bye') || 
                lowercaseTranscript.includes('goodbye') || 
                lowercaseTranscript.includes('thank')) {
                return this.getRandomResponse('closing');
            }

            return this.getRandomResponse('acknowledgment');
        } catch (error) {
            logger.error('Error in basic response generation:', error);
            return "I'm sorry, I didn't quite catch that. Could you please repeat?";
        }
    }

    getRandomResponse(category) {
        const responses = this.responses[category];
        if (!responses) {
            logger.warn(`No responses found for category: ${category}`);
            return this.responses.acknowledgment[0];
        }
        return responses[Math.floor(Math.random() * responses.length)];
    }

    getConversationHistory() {
        return []; // Basic generator doesn't maintain history
    }

    clearHistory() {
        // No-op for basic generator
    }
}
