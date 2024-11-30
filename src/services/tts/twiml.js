// src/services/tts/twiml.js
import Twilio from 'twilio';
import { logger } from '../../utils/logger.js';

export class TwiMLTTSService {
    constructor(config) {
        this.client = Twilio(config.twilio.accountSid, config.twilio.authToken);
        this.config = config;
    }

    async synthesize(text, callSid) {
        try {
            const response = await this.client.calls(callSid)
                .update({
                    twiml: `<Response><Say voice="${this.config.tts.voiceId}">${text}</Say></Response>`
                });
            return response.sid;
        } catch (error) {
            logger.error('TwiML synthesis error:', error);
            throw error;
        }
    }
}
