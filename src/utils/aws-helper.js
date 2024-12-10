// src/utils/aws-helper.js
import AWS from 'aws-sdk';
import { logger } from './logger.js';

export class AWSHelper {
    static setupAWS(config) {
        AWS.config.update({
            region: config.aws.region,
            // credentials: {
            //     accessKeyId: config.aws.accessKeyId,
            //     secretAccessKey: config.aws.secretAccessKey
            // },
            maxRetries: config.aws.maxRetries,
            httpOptions: {
                timeout: config.aws.timeout
            }
        });
    }

    static handleAWSError(error, service) {
        logger.error({
            msg: `AWS ${service} error`,
            error: error.message,
            code: error.code,
            requestId: error.requestId
        });
        
        if (error.code === 'ThrottlingException') {
            throw new Error('Service temporarily unavailable');
        }
        throw error;
    }
}