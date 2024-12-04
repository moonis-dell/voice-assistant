// src/services/speech/SpeechManager.js
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export class SpeechManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.state = {
            streamSid: null,
            isStreamStarted: false,
            turnCounter: 0,
            transcript: {
                accumulated: '',
                timer: null,
                waitTime: 3000, // 3 seconds
                lastTranscriptTime: null
            },
            tts: {
                isSpeaking: false,
                lastResponseTime: Date.now(),
                minResponseInterval: 1000
            }
        };
    }

    getTimestamp() {
        return new Date().toISOString().split('T')[1].slice(0, -1);
    }

    setStreamSid(streamSid) {
        this.state.streamSid = streamSid;
        this.state.isStreamStarted = true;
        console.log(`[${this.getTimestamp()}] Stream started with SID: ${streamSid}`);
    }

    isStreaming() {
        return this.state.isStreamStarted;
    }

    isSpeaking() {
        return this.state.tts.isSpeaking;
    }

    handleTranscript(transcript, isPartial) {
        if (isPartial){this.resetTranscriptTimer(); return} ;

        const trimmedTranscript = transcript.trim();
        if (!trimmedTranscript) return;

        if (this.state.tts.isSpeaking) {
            this.stopTTS();
        }

        console.log(`[${this.getTimestamp()}] transcript received: "${trimmedTranscript}"`);
        this.accumulateTranscript(trimmedTranscript);
    }

    accumulateTranscript(transcript) {
        if (this.state.transcript.accumulated) {
            this.state.transcript.accumulated += ' ' + transcript;
        } else {
            this.state.transcript.accumulated = transcript;
        }

        this.state.transcript.lastTranscriptTime = Date.now();
        console.log(`[${this.getTimestamp()}] Accumulated transcript: "${this.state.transcript.accumulated}"`);
        console.log(`[${this.getTimestamp()}] Starting 3-second timer...`);

        this.resetTranscriptTimer();
    }

    resetTranscriptTimer() {
        if (this.state.transcript.timer) {
            clearTimeout(this.state.transcript.timer);
            console.log(`[${this.getTimestamp()}] Reset timer - clearing previous timer`);
        }

        this.state.transcript.timer = setTimeout(() => {
            const timeWaited = (Date.now() - this.state.transcript.lastTranscriptTime) / 1000;
            console.log(`[${this.getTimestamp()}] Timer completed after ${timeWaited.toFixed(1)} seconds`);
            this.processAccumulatedTranscript();
        }, this.state.transcript.waitTime);
    }

    async processAccumulatedTranscript() {
        const transcript = this.state.transcript.accumulated.trim();
        if (!transcript) return;

        try {
            console.log(`[${this.getTimestamp()}] Processing final transcript: "${transcript}"`);
            
            this.emit('processingTranscript', transcript);
            
            this.state.transcript.accumulated = '';
            this.state.transcript.timer = null;
            this.state.transcript.lastTranscriptTime = null;
        } catch (error) {
            console.error(`[${this.getTimestamp()}] Error processing transcript:`, error);
            logger.error('Error processing transcript:', error);
        }
    }

    startTTS() {
        this.state.tts.isSpeaking = true;
        this.state.tts.lastResponseTime = Date.now();
        console.log(`[${this.getTimestamp()}] TTS started`);
        this.emit('ttsStarted');
    }

    stopTTS() {
        if (this.state.tts.isSpeaking) {
            this.state.tts.isSpeaking = false;
            console.log(`[${this.getTimestamp()}] TTS stopped`);
            this.emit('ttsStopped');
        }
    }

    cleanup() {
        if (this.state.transcript.timer) {
            clearTimeout(this.state.transcript.timer);
            console.log(`[${this.getTimestamp()}] Cleanup - clearing timer`);
        }
        this.state.transcript.accumulated = '';
        this.state.tts.isSpeaking = false;
        this.state.isStreamStarted = false;
        this.state.streamSid = null;
    }
}