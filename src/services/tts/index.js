// src/services/tts/index.js
import { config } from '../../config/index.js';
import { PollyTTSService } from './polly.js';
import { TwiMLTTSService } from './twiml.js';

export class TTSService {
    constructor() {        
        this.service = config.tts.provider === 'polly' 
            ? new PollyTTSService(config)
            : new TwiMLTTSService(config);
    }

    async synthesize(text) {
        return await this.service.synthesize(text);
    }
}


