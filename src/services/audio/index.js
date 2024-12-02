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


    // Initialize services
    try {
        audioTransformer = new AudioTransformer();
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

                // Setup audio stream and transcription only after receiving streamSid
                const audioStream = audioTransformer.createReadableStream();
                transcriptionStream = await transcribeService.startStream(audioStream);

                // Handle transcription results
                (async () => {
                    try {
                        for await (const event of transcriptionStream.TranscriptResultStream) {
                            if (event.TranscriptEvent?.Transcript?.Results?.[0]) {
                                const result = event.TranscriptEvent.Transcript.Results[0];
                                if(result.IsPartial){
                                    const ptranscript = result.Alternatives[0].Transcript;
                                    logger.info({ptranscript},'Partial Transcript')
                                }

                                if (!result.IsPartial) {
                                    const transcript = result.Alternatives[0].Transcript;
                                    logger.info({ streamSid, transcript }, 'Received transcript');



                                    // Generate response
                                    const response = await responseService.generateResponse(transcript);
                                    logger.info({ streamSid, response }, 'Generated response');




                                    // Verify streamSid exists before sending response
                                    if (response && streamSid) {
                                        logger.info({ streamSid }, 'Synthesizing speech');
                                        try {
                                            const audioResponse = await ttsService.synthesize(response);
                                            if (audioResponse) {
                                                const messageToSend = {
                                                    event: 'media',
                                                    streamSid: streamSid,
                                                    media: { payload: audioResponse }
                                                };
                                                logger.info({ streamSid }, 'Sending audio response');
                                                socket.send(JSON.stringify(messageToSend));
                                            }
                                        } catch (error) {
                                            logger.error({ streamSid }, 'TTS error:', error);
                                        }

                                        ///////////////////////////////////////////////////////////////////////////
                                        //turnCounter++;

                                        // Save customer transcript
                                        // await transcriptService.saveTranscript({
                                        //     callId: streamSid,
                                        //     actor: 'customer',
                                        //     text: transcript,
                                        //     turnId: turnCounter
                                        // });
                                        //////////////////////////////////////////////////////////////////////////


                                        //////////////////////////////////////////////////////////////////////////////
                                        // Save customer transcript
                                        // await transcriptService.saveTranscript({
                                        //     callId: streamSid,
                                        //     actor: 'agent',
                                        //     text: response,
                                        //     turnId: turnCounter
                                        // });
                                        ////////////////////////////////////////////////////////////////////////////////  




                                    } else {
                                        logger.warn('No streamSid available for response');
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
                audioTransformer.write(data.toString());

            } else if (msg.event === 'stop') {
                logger.info({ streamSid }, 'Stream stopped');
                cleanupResources();
            }
        } catch (error) {
            logger.error({ streamSid }, 'Error processing WebSocket message:', error);
        }
    });

    // Handle WebSocket closure
    socket.on('close', () => {
        logger.info({ streamSid }, 'WebSocket connection closed');
        cleanupResources();
    });

    // Handle WebSocket errors
    socket.on('error', (error) => {
        logger.error({ streamSid }, 'WebSocket error:', error);
        cleanupResources();
    });

    async function cleanupResources() {
        try {
            if (audioTransformer) {
                audioTransformer.end();
            }
            socket.close();
            if (socket.readyState === socket.OPEN) {
                socket.close();
            }
            streamSid = null;
            isStreamStarted = false;
        } catch (error) {
            logger.error('Error in cleanup:', error);
        }
    }
}