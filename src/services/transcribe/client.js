// src/services/transcribe/client.js
import { 
    TranscribeStreamingClient, 
    StartStreamTranscriptionCommand 
} from "@aws-sdk/client-transcribe-streaming";
import { logger } from '../../utils/logger.js';

export class TranscribeClient {
    constructor(config) {
        // if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
        //     throw new Error('AWS credentials not provided');
        // }

        this.client = new TranscribeStreamingClient({
            region: config.aws.region,
            // credentials: {
            //     accessKeyId: config.aws.accessKeyId,
            //     secretAccessKey: config.aws.secretAccessKey
            // }          
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
                EnablePartialResultsStabilization: true,
                PartialResultsStability: "high",
                ShowSpeakerLabels: false,
                //VocabularyName: this.config.aws.vocabularyName // optional
            });

            logger.info('Sending transcription command');
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