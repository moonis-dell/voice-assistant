// src/services/audio/transformer.js
import { Transform } from 'stream';
import { Buffer } from 'buffer';
import alawmulaw from 'alawmulaw';
import { logger } from '../../utils/logger.js';

export class AudioTransformer extends Transform {
    constructor() {
        super();
        this.audioBuffer = Buffer.alloc(0);        
    }

    createReadableStream() {
        return this;
    }

    _transform(chunk, encoding, callback) {
        try {
            const msg = JSON.parse(chunk.toString('utf8'));
            if (msg.event === 'media' && msg.media?.payload) {
                const buffer = Buffer.from(msg.media?.payload, 'base64');

                 // Skip silent audio
                 if (this.isSilent(buffer)) {
                    return callback();
                }
                const processedAudio = this.processAudioChunk(buffer);
                this.push(processedAudio);

                
            }
            callback();
        } catch (error) {
            logger.error('Audio transform error:', error);
            callback(error);
        }
    }

    isSilent(buffer) {
        // Check if buffer contains only silent audio
        return buffer.every(byte => byte === buffer[0]);
    }

    processAudioChunk(buffer) {        
        const muLawSamples = new Uint8Array(buffer);
        return Buffer.from(alawmulaw.mulaw.decode(muLawSamples).buffer);
    }
}

