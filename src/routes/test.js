// src/routes/test.js
export async function testRoutes(fastify) {
    // Test TTS synthesis
    fastify.post('/tts', async (request, reply) => {
        try {
            const { text } = request.body;
            const ttsService = new TTSService();
            const audioResponse = await ttsService.synthesize(text);
            
            return { success: true, audio: audioResponse };
        } catch (error) {
            logger.error('TTS test error:', error);
            throw error;
        }
    });

    // Test response generation
    fastify.post('/response', async (request, reply) => {
        try {
            const { text } = request.body;
            const responseService = new ResponseService();
            const response = responseService.generateResponse(text);
            
            return { success: true, response };
        } catch (error) {
            logger.error('Response generation test error:', error);
            throw error;
        }
    });
}
