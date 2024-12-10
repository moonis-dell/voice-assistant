import { logger } from '../../utils/logger.js';

/**
 * Handles WebSocket connections and audio streaming for the voice assistant
 * @class WebSocketHandler
 */
export class WebSocketHandler {
    constructor(socket, speechManager, services) {
        this.socket = socket;
        this.speechManager = speechManager;
        this.services = services;
        this.markQueue = [];
        this.lastResponseStartTime = null;
        this.isInterrupted = false;
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // WebSocket event handlers
        this.socket.on('message', async (rawData) => {
            try {
                const data = this.parseWebSocketMessage(rawData);
                await this.handleMessage(JSON.parse(data));
            } catch (error) {
                logger.error({ error }, 'WebSocket message error');
            }
        });

        this.socket.on('close', () => this.handleClose());
        this.socket.on('error', (error) => this.handleError(error));

        // Speech manager event handlers
        this.speechManager.on('processingTranscript', async (transcript) => {
            await this.handleTranscriptProcessing(transcript);
        });

        this.speechManager.on('speakerChange', ({ previous, current }) => {
           // logger.info({ previous, current }, 'Speaker changed');
        });
    }

    parseWebSocketMessage(rawData) {
        if (Buffer.isBuffer(rawData)) {
            return rawData.toString('utf8');
        } else if (typeof rawData === 'string') {
            return rawData;
        } else if (rawData instanceof Uint8Array) {
            return Buffer.from(rawData).toString('utf8');
        }
        throw new Error('Unsupported WebSocket data format');
    }

    async handleMessage(msg) {
        try {
            switch (msg.event) {
                case 'start':
                    await this.handleStart(msg);
                    break;
                case 'media':
                    await this.handleMedia(msg);
                    break;
                case 'mark':
                    this.handleMarkEvent();
                    break;
                case 'stop':
                    await this.handleStop();
                    break;
                default:
                    logger.warn({ event: msg.event }, 'Unknown message event');
            }
        } catch (error) {
            logger.error({ error, event: msg?.event }, 'Message handling error');
        }
    }

    async handleStart(msg) {
        const { streamSid } = msg.start;
        this.speechManager.setStreamSid(streamSid);
        
        const audioStream = this.services.audioTransformer.createReadableStream();
        const transcriptionStream = await this.services.transcribeService.startStream(audioStream);
        
        this.handleTranscriptionStream(transcriptionStream);
    }

    async handleTranscriptionStream(transcriptionStream) {
        try {
            for await (const event of transcriptionStream.TranscriptResultStream) {
                if (event.TranscriptEvent?.Transcript?.Results?.[0]) {
                    const result = event.TranscriptEvent.Transcript.Results[0];
                    const transcript = result.Alternatives[0].Transcript;
                    if (transcript.trim()) {
                        this.speechManager.handleTranscript(transcript, result.IsPartial);
                    }
                }
            }
        } catch (error) {
            logger.error({ error }, 'Transcription stream error');
        }
    }

    sendMark() {
        const markEvent = {
            event: 'mark',
            streamSid: this.speechManager.state.streamSid,
            mark: { name: 'responsePart' }
        };
        this.socket.send(JSON.stringify(markEvent));
        this.markQueue.push('responsePart');
    }

    handleMarkEvent() {
        //console.log('Mark Event Received!')
        if (this.markQueue.length > 0) {
            this.markQueue.shift();
        }
    }

    handleCustomerSpeech() {
        // Only handle if we have marks in queue AND a valid start timestamp
        if (this.markQueue.length > 0 && this.lastResponseStartTime != null) {
            // Calculate how long TTS was playing before interruption
            const elapsedTime = Date.now() - this.lastResponseStartTime;
            
            logger.info(`Speech interrupted after ${elapsedTime}ms of TTS playback`);
           // console.log('STOPPED!!! STOPPED!!! STOPPED!!! STOPPED!!! STOPPED!!! ')
            // Stop TTS and send clear event
            this.speechManager.stopTTS();
            this.socket.send(JSON.stringify({
                event: 'clear',
                streamSid: this.speechManager.state.streamSid
            }));
    
            // Reset all tracking variables
            this.markQueue = [];
            this.lastResponseStartTime = null;
            
            logger.info(`Customer interrupted after ${elapsedTime}ms - cleared audio playback`);
        }
    }

    async handleTranscriptProcessing(transcript) {
        try {
            if (this.speechManager.isSpeaking()) {
                logger.info('Skipping response generation - TTS in progress');
                return;
            }

            logger.info({ transcript }, 'Generating agent response');
            const response = await this.services.responseService.generateResponse(
                transcript,
                this.speechManager.state.streamSid
            );

            if (response) {
                await this.generateAndStreamTTS(response);
            }
        } catch (error) {
            logger.error({ error }, 'Response processing error');
            this.speechManager.stopTTS();
        }
    }

    async generateAndStreamTTS(response) {
        try {
            logger.info({ response }, 'Starting TTS generation');
            this.speechManager.startTTS();
            this.lastResponseStartTime = Date.now();
            let chunkCount = 0;
            const MARK_INTERVAL = 5; // Send mark every 5 chunks

            const audioGenerator = await this.services.ttsService.synthesize(response);
            
            for await (const chunk of audioGenerator) {
                if (chunk) {
                    this.sendAudioChunk(chunk);                  
                           
                        this.sendMark();
                    
                    
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            }

            this.speechManager.stopTTS();
            this.lastResponseStartTime = null;
        } catch (error) {
            logger.error({ error }, 'Error in TTS generation');
            this.speechManager.stopTTS();
        }
    }

    async handleMedia(msg) {
        if (!this.speechManager.isStreaming()) {
            logger.warn('Received media before stream start');
            return;
        }

        // Only check for interruption if not already interrupted
        if (this.markQueue.length > 0 && this.lastResponseStartTime != null) {
            this.handleCustomerSpeech();
        }

        this.services.audioTransformer.write(JSON.stringify(msg));
    }

    sendAudioChunk(audioChunk) {
        const EXPECTED_CHUNK_SIZE = 320; // Standard chunk size for 20ms of audio at 8kHz
        
        if (Buffer.from(audioChunk, 'base64').length !== EXPECTED_CHUNK_SIZE) {
            logger.warn('Unexpected chunk size:', Buffer.from(audioChunk, 'base64').length);
        }

        const messageToSend = {
            event: 'media',
            streamSid: this.speechManager.state.streamSid,
            media: { payload: audioChunk }
        };
        this.socket.send(JSON.stringify(messageToSend));
    }

    async handleStop() {
        logger.info('Handling stop event');
        await this.cleanup();
    }

    async handleClose() {
        logger.info('WebSocket connection closed');
        await this.cleanup();
    }

    async handleError(error) {
        logger.error({ error }, 'WebSocket error');
        await this.cleanup();
    }

    async cleanup() {
        this.markQueue = [];
        this.lastResponseStartTime = null;
        this.isInterrupted = false;
        this.speechManager.cleanup();
        await this.services.cleanup?.();
    }
}