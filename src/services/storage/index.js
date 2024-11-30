// src/services/recorder/index.js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { PassThrough } from 'stream';
import BlockStream from 'block-stream2';
import interleave from 'interleave-stream';
import fs from 'fs';
import { logger } from '../../utils/logger.js';

export class AudioRecorderService {
    constructor(config) {
        this.s3Client = new S3Client({
            region: config.aws.region,
            credentials: {
                accessKeyId: config.aws.accessKeyId,
                secretAccessKey: config.aws.secretAccessKey
            }
        });
        
        this.tempFilePath = config.recording.tempPath;
        this.writeStream = null;
        this.agentBlock = new BlockStream(2);
        this.callerBlock = new BlockStream(2);
        this.combinedStream = new PassThrough();
        this.combinedStreamBlock = new BlockStream(4);
        this.keepAliveChunk = Buffer.alloc(2, 0);
        this.keepAliveInterval = null;
    }

    startRecording(callId) {
        const tempFileName = `${callId}-${lambdaCount}.raw`;
        const fullPath = this.tempFilePath + tempFileName;
        this.writeStream = fs.createWriteStream(fullPath);

        // Setup stream pipeline
        this.combinedStream.pipe(this.combinedStreamBlock);
        this.combinedStreamBlock.on('data', (chunk) => {
            this.writeStream.write(chunk);
        });

        // Interleave caller and agent streams
        interleave([this.callerBlock, this.agentBlock]).pipe(this.combinedStream);

        // Setup keep-alive for both streams
        this.keepAliveInterval = setInterval(() => {
            this.agentBlock.write(this.keepAliveChunk);
            this.callerBlock.write(this.keepAliveChunk);
        }, 10000); // 10 seconds keep-alive

        logger.info({ callId, lambdaCount }, 'Started recording with separate streams');
        return tempFileName;
    }

    writeCustomerAudio(chunk) {
        if (chunk && chunk.length > 0) {
            this.callerBlock.write(chunk);
        }
    }

    writeAgentAudio(chunk) {
        if (chunk && chunk.length > 0) {
            this.agentBlock.write(chunk);
        }
    }

    async writeToS3(tempFileName) {
        const sourceFile = this.tempFilePath + tempFileName;
        logger.info('Uploading audio to S3');

        let data;
        const fileStream = fs.createReadStream(sourceFile);
        const uploadParams = {
            Bucket: this.config.aws.audioBucket,
            Key: this.config.raw.prefix + tempFileName,
            Body: fileStream
        };

        try {
            data = await this.s3Client.send(new PutObjectCommand(uploadParams));
            logger.info('Uploading to S3 complete:', data);
        } catch (err) {
            logger.error('S3 upload error:', err);
            throw err;
        } finally {
            fileStream.destroy();
        }
        return data;
    }

    async stopRecording(tempFileName) {
        try {
            if (this.keepAliveInterval) {
                clearInterval(this.keepAliveInterval);
            }

            // End all streams
            this.callerBlock.end();
            this.agentBlock.end();
            this.combinedStream.end();
            
            if (this.writeStream) {
                this.writeStream.end();
            }

            // Upload to S3
            await this.writeToS3(tempFileName);
            
            // Clean up temp file
            await fs.promises.unlink(this.tempFilePath + tempFileName);

            return true;
        } catch (error) {
            logger.error({ error }, 'Error in stop recording process');
            throw error;
        }
    }
}