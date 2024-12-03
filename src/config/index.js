// src/config/index.js
import dotenv from 'dotenv';
dotenv.config();

export const config = {
    s3: {
        audioBucket: process.env.S3_AUDIO_BUCKET || 'call-recordings-twilio-moonis',
        region: process.env.AWS_REGION || 'us-east-1',
        uploadTimeout: parseInt(process.env.S3_UPLOAD_TIMEOUT || '7200000'), // 2 hours
        partSize: parseInt(process.env.S3_PART_SIZE || '5242880') // 5MB
    },
    dynamodb: {
        tableName: process.env.DYNAMODB_TABLE_NAME || 'voice-assistant-transcription',
        ttl: 30 * 24 * 60 * 60, // 30 days retention
        enableStreaming: false,
        
    },    
    aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        maxRetries: 3,
        timeout: 5000
    },
    server: {
        port: parseInt(process.env.PORT || '5050'),
        host: '0.0.0.0',
        trustProxy: true,
        connectionTimeout: 30000
    },
    audio: {
        sampleRate: 8000,
        encoding: 'pcm',
        chunkSize: 320
    },
    tts: {
        provider: process.env.TTS_PROVIDER || 'polly',
        voiceId: process.env.VOICE_ID || 'Ruth',
        cacheEnabled: false,
        cacheTTL: 3600 // 1 hour
    },
    response: {
        type: process.env.RESPONSE_GENERATOR || 'basic', // 'basic' or 'groq'
    },
    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN
    },
    security: {
        maxPayloadSize: 5 * 1024 * 1024, // 5MB
        rateLimit: {
            enabled: true,
            windowMs: 60 * 1000, // 1 minute
            max: 100 // requests per windowMs
        }
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        prettyPrint: true,//process.env.NODE_ENV !== 'production'
    },
    groq: {
        enabled: process.env.GROQ_ENABLED === 'true',
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '100'),
        temperature: parseFloat(process.env.GROQ_TEMPERATURE || '0.7'),
        fallbackEnabled: true
    }
};
