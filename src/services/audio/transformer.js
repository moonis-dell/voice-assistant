// src/services/audio/transformer.js
import { Transform } from 'stream';
import { PassThrough } from 'stream';
import { Buffer } from 'buffer';
import alawmulaw from 'alawmulaw';
import { logger } from '../../utils/logger.js';

export class AudioTransformer extends Transform {
    constructor(config) {
        super();
        // Create PassThrough stream with optimal buffer size
        this.passthroughStream = new PassThrough({
            highWaterMark: config.audio.chunkSize
        });
    }

    createReadableStream() {
        return this.passthroughStream;
    }

    _transform(chunk, encoding, callback) {
        try {
            const msg = JSON.parse(chunk.toString('utf8'));
            if (msg.event === 'media' && msg.media?.payload) {
                const buffer = Buffer.from(msg.media.payload, 'base64');
                const muLawSamples = new Uint8Array(buffer);
                const pcmSamples = alawmulaw.mulaw.decode(muLawSamples);
                
                // Stream the PCM data immediately
                this.passthroughStream.write(Buffer.from(pcmSamples.buffer));
            }
            callback();
        } catch (error) {
            logger.error('Audio transform error:', error);
            callback(error);
        }
    }

    _flush(callback) {
        this.passthroughStream.end();
        callback();
    }
}