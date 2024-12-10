import AWS from 'aws-sdk';
import alawmulaw from 'alawmulaw';
import { Transform } from 'stream';

const CHUNK_SIZE = 320; // Standard size for audio chunks in bytes

export class PollyTTSService {
    constructor(config) {
        this.polly = new AWS.Polly({
            region: config.aws.region,
        });
        this.cache = new Map();
        this.config = config;
    }

    async* generateAudioChunks(audioBuffer) {
        // Create Int16Array from the complete buffer
        const pcmSamples = new Int16Array(audioBuffer);
        
        // Process in chunks
        for (let offset = 0; offset < pcmSamples.length; offset += CHUNK_SIZE) {
            // Get chunk of PCM samples
            const chunk = pcmSamples.slice(offset, offset + CHUNK_SIZE);
            
            // Convert chunk to mu-law
            const muLawChunk = alawmulaw.mulaw.encode(chunk);
            
            // Convert to base64 and yield
            yield Buffer.from(muLawChunk).toString('base64');
        }
    }

    async synthesize(text, callId) {
        const params = {
            Engine: 'neural',
            OutputFormat: 'pcm',
            SampleRate: String(this.config.audio.sampleRate),
            Text: `<speak>${text}</speak>`,
            TextType: 'ssml',
            VoiceId: this.config.tts.voiceId
        };

        try {
            const response = await this.polly.synthesizeSpeech(params).promise();
            if (!response.AudioStream?.buffer) {
                throw new Error('Invalid Polly response');
            }

            // Return an async generator for streaming chunks
            return this.generateAudioChunks(response.AudioStream.buffer);

        } catch (error) {
            console.error('Polly TTS error:', error);
            throw error;
        }
    }
}