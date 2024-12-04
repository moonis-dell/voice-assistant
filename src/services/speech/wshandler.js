// src/services/speech/WebSocketHandler.js
import { logger } from '../../utils/logger.js';

export class WebSocketHandler {
    constructor(socket, speechManager, services) {
        this.socket = socket;
        this.speechManager = speechManager;
        this.services = services;
        this.setupEventHandlers();
    }

    getTimestamp() {
        return new Date().toISOString().split('T')[1].slice(0, -1);
    }

    setupEventHandlers() {
        this.socket.on('message', async (rawData) => {
            try {
                let data;
                if (Buffer.isBuffer(rawData)) {
                    data = rawData.toString('utf8');
                } else if (typeof rawData === 'string') {
                    data = rawData;
                } else if (rawData instanceof Uint8Array) {
                    data = Buffer.from(rawData).toString('utf8');
                } else {
                    throw new Error('Unsupported data format');
                }

                const msg = JSON.parse(data);
                await this.handleMessage(msg);
            } catch (error) {
                console.error(`[${this.getTimestamp()}] WebSocket message error:`, error);
                logger.error('Error processing WebSocket message:', {
                    error: error.message,
                    dataType: typeof rawData,
                    isBuffer: Buffer.isBuffer(rawData)
                });
            }
        });

        this.socket.on('close', () => this.handleClose());
        this.socket.on('error', (error) => this.handleError(error));

        this.speechManager.on('processingTranscript', async (transcript) => {
            await this.handleTranscriptProcessing(transcript);
        });

        this.speechManager.on('ttsStopped', () => {
            this.sendStopTTS();
        });
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
                case 'stop':
                    await this.handleStop();
                    break;
                default:
                    console.log(`[${this.getTimestamp()}] Unknown message event:`, msg.event);
            }
        } catch (error) {
            console.error(`[${this.getTimestamp()}] Message handling error:`, error);
            logger.error('Message handling error:', {
                error: error.message,
                event: msg?.event
            });
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
                    console.log(`[${this.getTimestamp()}] Partial transcript: `+transcript);
                   // if (!result.IsPartial && transcript.trim()) {
                        //console.log(`[${this.getTimestamp()}] Received  transcript`);
                        this.speechManager.handleTranscript(transcript, result.IsPartial);
                    //}
                }
            }
        } catch (error) {
            console.error(`[${this.getTimestamp()}] Transcription stream error:`, error);
            logger.error('Transcription stream error:', error);
        }
    }

    async handleTranscriptProcessing(transcript) {
        try {
            console.log(`[${this.getTimestamp()}] Generating response for: "${transcript}"`);

            const response = await this.services.responseService.generateResponse(
                transcript,
                this.speechManager.state.streamSid
            );

            if (response && !this.speechManager.isSpeaking()) {
                console.log(`[${this.getTimestamp()}] Response generated: "${response}"`);
                this.speechManager.startTTS();
                const audioResponse = await this.services.ttsService.synthesize(response);
                if (audioResponse) {
                    console.log(`[${this.getTimestamp()}] Sending audio response`);
                    this.sendAudioResponse(audioResponse);
                }
                this.speechManager.stopTTS();
            }
        } catch (error) {
            console.error(`[${this.getTimestamp()}] Response processing error:`, error);
            logger.error('Response processing error:', error);
        }
    }

    sendAudioResponse(audioResponse) {
        const messageToSend = {
            event: 'media',
            streamSid: this.speechManager.state.streamSid,
            media: { payload: audioResponse }
        };
        this.socket.send(JSON.stringify(messageToSend));
    }

    sendStopTTS() {
        console.log(`[${this.getTimestamp()}] Sending stop TTS signal`);
        this.socket.send(JSON.stringify({
            event: 'stop_tts',
            streamSid: this.speechManager.state.streamSid
        }));
    }

    handleMedia(msg) {
        if (!this.speechManager.isStreaming()) {
            console.warn(`[${this.getTimestamp()}] Received media before stream start`);
            return;
        }
        this.services.audioTransformer.write(JSON.stringify(msg));
    }

    async handleStop() {
        console.log(`[${this.getTimestamp()}] Handling stop event`);
        await this.cleanup();
    }

    async handleClose() {
        console.log(`[${this.getTimestamp()}] WebSocket connection closed`);
        await this.cleanup();
    }

    async handleError(error) {
        console.error(`[${this.getTimestamp()}] WebSocket error:`, error);
        await this.cleanup();
    }

    async cleanup() {
        this.speechManager.cleanup();
        await this.services.cleanup?.();
    }
}