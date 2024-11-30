import AWS from 'aws-sdk';
import alawmulaw from 'alawmulaw';

export class PollyTTSService {
    constructor(config) {
        this.polly = new AWS.Polly({
            region: config.aws.region,
            credentials: {
                accessKeyId: config.aws.accessKeyId,
                secretAccessKey: config.aws.secretAccessKey
            }
        });
        this.cache = new Map();
        this.config = config;
       
    }

    async synthesize(text,callId) {
        const cacheKey = `${this.config.tts.voiceId}:${text}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

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

            const pcmSamples = new Int16Array(response.AudioStream.buffer);
            const muLawSamples = alawmulaw.mulaw.encode(pcmSamples);
            const audioData = Buffer.from(muLawSamples).toString('base64');           
            
            this.cache.set(cacheKey, audioData);
            return audioData;
        } catch (error) {
            console.error('Polly TTS error:', error);
            throw error;
        }
    }
}
