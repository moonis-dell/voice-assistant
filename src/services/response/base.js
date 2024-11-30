// src/services/response/base.js
export class BaseResponseGenerator {
    async generateResponse(transcript, sessionId = null) {
        throw new Error('Method not implemented');
    }

    getConversationHistory(sessionId) {
        throw new Error('Method not implemented');
    }

    clearHistory(sessionId) {
        throw new Error('Method not implemented');
    }
}
