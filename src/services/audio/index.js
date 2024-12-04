// src/services/audio/index.js
import { AudioTransformer } from './transformer.js';
import { TranscribeService } from '../transcribe/index.js';
import { TranscriptService } from '../dynamodb/index.js';
import { TTSService } from '../tts/index.js';
import { ResponseService } from '../response/index.js';
import { logger } from '../../utils/logger.js';
import { config } from '../../config/index.js';

export async function setupWebSocketHandler(connection, req) {
    const { socket } = connection;
    let streamSid = null;
    let turnCounter = 0;
    let isStreamStarted = false;
    let audioTransformer = null;
    let transcribeService = null;
    let ttsService = null;
    let responseService = null;
    let transcriptionStream = null;
    let transcriptService = null;

    // Speech state management
    let speechState = {
        lastTranscript: '',
        lastProcessTime: Date.now(),
        isProcessing: false,
        accumulatedTranscript: '',
        lastResponseTime: Date.now(),
        MIN_RESPONSE_INTERVAL: 1000
    };


    // Initialize services
    try {
        audioTransformer = new AudioTransformer(config);
        transcribeService = new TranscribeService(config);
        ttsService = new TTSService();
        responseService = new ResponseService(config);
        transcriptService = new TranscriptService(config);
    } catch (error) {
        logger.error('Error initializing services:', error);
        socket.close();
        return;
    }



    // Handle incoming WebSocket messages
    socket.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.event === 'start') {
                streamSid = msg.start.streamSid;
                logger.info({ streamSid }, 'Stream started');
                isStreamStarted = true;

                const audioStream = audioTransformer.createReadableStream();
                transcriptionStream = await transcribeService.startStream(audioStream);

                // Handle transcription results
                (async () => {
                    try {
                        for await (const event of transcriptionStream.TranscriptResultStream) {
                            if (event.TranscriptEvent?.Transcript?.Results?.[0]) {
                                const result = event.TranscriptEvent.Transcript.Results[0];
                                const pTranscript = result.Alternatives[0].Transcript;
                                //logger.info({ streamSid, pTranscript }, 'Received Partial Transcript');
                                const currentTime = Date.now();
                                if (!result.IsPartial) {
                                    const transcript = result.Alternatives[0].Transcript.trim();
                                    logger.info({ streamSid, transcript }, 'Received Transcript');
                                    if (!speechState.isProcessing) {
                                        speechState.isProcessing = true;
                                        try {
                                            const response = await responseService.generateResponse(transcript,streamSid);
                                            logger.info({ streamSid, response }, 'Generated response');

                                            if (response && streamSid) {
                                                const audioResponse = await ttsService.synthesize(response);
                                                if (audioResponse) {
                                                    const messageToSend = {
                                                        event: 'media',
                                                        streamSid: streamSid,
                                                        media: { payload: audioResponse }
                                                    };
                                                    socket.send(JSON.stringify(messageToSend));
                                                    speechState.lastResponseTime = currentTime;

                                                    // Save transcripts
                                                    // await Promise.all([
                                                    //     transcriptService.saveTranscript({
                                                    //         callId: streamSid,
                                                    //         actor: 'customer',
                                                    //         text: fullTranscript,
                                                    //         turnId: turnCounter
                                                    //     }),
                                                    //     transcriptService.saveTranscript({
                                                    //         callId: streamSid,
                                                    //         actor: 'agent',
                                                    //         text: response,
                                                    //         turnId: turnCounter
                                                    //     })
                                                    // ]);

                                                    // turnCounter++;
                                                    // Clear accumulated transcript after processing
                                                    speechState.accumulatedTranscript = '';
                                                }
                                            }
                                        } finally {
                                            speechState.isProcessing = false;
                                        }
                                    }


                                }
                            }
                        }
                    } catch (error) {
                        logger.error({ streamSid }, 'Transcription stream error:', error);
                    }
                })();

            } else if (msg.event === 'media' && msg.media?.payload) {
                if (!isStreamStarted) {
                    logger.warn('Received media before stream start');
                    return;
                }
                audioTransformer.write(data);
            } else if (msg.event === 'stop') {
                logger.info({ streamSid }, 'Stream stopped');
                await cleanupResources();
            }
        } catch (error) {
            logger.error({ streamSid }, 'Error processing WebSocket message:', error);
        }
    });

    // Handle WebSocket closure
    socket.on('close', async () => {
        logger.info({ streamSid }, 'WebSocket connection closed');
        await cleanupResources();
    });

    // Handle WebSocket errors
    socket.on('error', async (error) => {
        logger.error({ streamSid }, 'WebSocket error:', error);
        await cleanupResources();
    });

    async function cleanupResources() {
        try {
            if (audioTransformer) {
                audioTransformer.end();
            }
            if (transcriptionStream) {
                transcriptionStream = null;
            }
            if (socket.readyState === socket.OPEN) {
                socket.close();
            }
            streamSid = null;
            isStreamStarted = false;
            // Clear speech state
            speechState.accumulatedTranscript = '';
            speechState.isProcessing = false;
        } catch (error) {
            logger.error('Error in cleanup:', error);
        }
    }
}