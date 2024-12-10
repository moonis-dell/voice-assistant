import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

/**
 * Manages speech states and events for the voice assistant
 * @class SpeechManager
 * @extends EventEmitter
 */
export class SpeechManager extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.state = {
            streamSid: null,
            isStreamStarted: false,
            currentSpeaker: null,
            turnCounter: 0,
            transcript: {
                accumulated: '',
                timer: null,
                waitTime: 1000, // 1.5 seconds wait time for final transcript
                lastTranscriptTime: null
            },
            tts: {
                isSpeaking: false,
                lastResponseTime: Date.now()
            }
        };
        
        this.SPEAKERS = {
            CUSTOMER: 'CUSTOMER',
            AGENT: 'AGENT',
            NONE: 'NONE'
        };
    }

    setStreamSid(streamSid) {
        this.state.streamSid = streamSid;
        this.state.isStreamStarted = true;
        logger.info({ streamSid }, 'Stream started');
    }

    setCurrentSpeaker(speaker) {
        const previousSpeaker = this.state.currentSpeaker;
        this.state.currentSpeaker = speaker;
        
        if (previousSpeaker !== speaker) {
            this.emit('speakerChange', { previous: previousSpeaker, current: speaker });
        }
    }

    isStreaming() {
        return this.state.isStreamStarted;
    }

    isSpeaking() {
        return this.state.tts.isSpeaking;
    }

    handleTranscript(transcript, isPartial) {
        this.setCurrentSpeaker(this.SPEAKERS.CUSTOMER);

        if (isPartial) {
            this.resetTranscriptTimer();
            return;
        }

        const trimmedTranscript = transcript.trim();
        if (!trimmedTranscript) return;

        logger.info({ transcript: trimmedTranscript }, 'Customer transcript received');
        this.accumulateTranscript(trimmedTranscript);
    }

    accumulateTranscript(transcript) {
        if (this.state.transcript.accumulated) {
            this.state.transcript.accumulated += ' ' + transcript;
        } else {
            this.state.transcript.accumulated = transcript;
        }

        this.state.transcript.lastTranscriptTime = Date.now();
        this.resetTranscriptTimer();
    }

    resetTranscriptTimer() {
        if (this.state.transcript.timer) {
            clearTimeout(this.state.transcript.timer);
            console.log(`Reset timer - clearing previous timer`);
        }

        this.state.transcript.timer = setTimeout(() => {
            //const timeWaited = (Date.now() - this.state.transcript.lastTranscriptTime) / 1000;
            console.log(`Timer completed after seconds`);
            this.processAccumulatedTranscript();
        }, this.state.transcript.waitTime);
    }

    async processAccumulatedTranscript() {
        const transcript = this.state.transcript.accumulated.trim();
        if (!transcript) return;

        try {
            logger.info({ transcript }, 'Processing final transcript');
            this.emit('processingTranscript', transcript);
            
            // Clear accumulated transcript
            this.state.transcript.accumulated = '';
            this.state.transcript.timer = null;
            this.state.transcript.lastTranscriptTime = null;
        } catch (error) {
            logger.error({ error }, 'Error processing transcript');
            throw error;
        }
    }

    startTTS() {
        this.state.tts.isSpeaking = true;
        this.state.tts.lastResponseTime = Date.now();
        this.setCurrentSpeaker(this.SPEAKERS.AGENT);
    }

    stopTTS() {
        this.state.tts.isSpeaking = false;
        this.setCurrentSpeaker(this.SPEAKERS.NONE);
    }

    cleanup() {
        if (this.state.transcript.timer) {
            clearTimeout(this.state.transcript.timer);
        }
        this.state.transcript.accumulated = '';
        this.state.tts.isSpeaking = false;
        this.state.isStreamStarted = false;
        this.state.streamSid = null;
        this.setCurrentSpeaker(this.SPEAKERS.NONE);
        logger.info('Speech manager cleaned up');
    }
}