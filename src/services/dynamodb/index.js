// src/services/dynamodb/transcript-service.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
    DynamoDBDocumentClient, 
    PutCommand,
    QueryCommand
} from "@aws-sdk/lib-dynamodb";
import { logger } from '../../utils/logger.js';

export class TranscriptService {
    constructor(config) {
        const client = new DynamoDBClient({
            region: config.aws.region
            // credentials: {
            //     accessKeyId: config.aws.accessKeyId,
            //     secretAccessKey: config.aws.secretAccessKey
            // }
        });
        
        this.docClient = DynamoDBDocumentClient.from(client);
        this.tableName = config.dynamodb.tableName;
    }

    async saveTranscript(transcriptData) {
        try {
            const timestamp = Date.now().toString();
            
            const params = {
                TableName: this.tableName,
                Item: {
                    callId: transcriptData.callId, // Partition key
                    sortKey: `${timestamp}#${transcriptData.actor}`, // Sort key
                    text: transcriptData.text,
                    actor: transcriptData.actor,
                    turnId: transcriptData.turnId,
                    timestamp: new Date(parseInt(timestamp)).toISOString()
                }
            };

            await this.docClient.send(new PutCommand(params));
            logger.info({ 
                callId: transcriptData.callId,
                sortKey: params.Item.sortKey,
                actor: transcriptData.actor 
            }, 'Transcript saved');
            
        } catch (error) {
            logger.error('Error saving transcript to DynamoDB:', error);
            throw error;
        }
    }

    async getCallTranscripts(callId) {
        try {
            const params = {
                TableName: this.tableName,
                KeyConditionExpression: 'callId = :callId',
                ExpressionAttributeValues: {
                    ':callId': callId
                }
            };

            const response = await this.docClient.send(new QueryCommand(params));
            // Sort by timestamp if needed
            return response.Items.sort((a, b) => {
                const timeA = a.sortKey.split('#')[0];
                const timeB = b.sortKey.split('#')[0];
                return timeA - timeB;
            });
            
        } catch (error) {
            logger.error('Error retrieving transcripts from DynamoDB:', error);
            throw error;
        }
    }
}