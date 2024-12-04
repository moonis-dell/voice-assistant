// src/services/transcribe/client.js
import { 
    TranscribeStreamingClient, 
    StartStreamTranscriptionCommand 
} from "@aws-sdk/client-transcribe-streaming";
import { logger } from '../../utils/logger.js';

export class TranscribeClient {
    constructor(config) {
        this.client = new TranscribeStreamingClient({
            region: config.aws.region,
        });
        this.config = config;
    }

    async startStream(audioStream) {
        try {
            logger.info('Starting transcription stream');
            
            const command = new StartStreamTranscriptionCommand({
                LanguageCode: "en-US",
                MediaSampleRateHertz: this.config.audio.sampleRate,
                MediaEncoding: "pcm",
                AudioStream: this.createAudioStream(audioStream),
                // Enable partial results with low stability for faster transcription
                EnablePartialResultsStabilization: true,
                PartialResultsStability:"low",
                // Disable features we don't need for faster processing
                ShowSpeakerLabels: false
            });

            return await this.client.send(command);
        } catch (error) {
            logger.error('Failed to start transcription stream:', {
                error: error.message,
                code: error.code,
                requestId: error.$metadata?.requestId
            });
            throw error;
        }
    }

    createAudioStream(audioStream) {
        return async function* () {
            try {
                for await (const chunk of audioStream) {
                    yield { AudioEvent: { AudioChunk: chunk } };
                }
            } catch (error) {
                logger.error('Error in audio stream:', error);
                throw error;
            }
        }();
    }
}