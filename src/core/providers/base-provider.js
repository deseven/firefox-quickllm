// Abstract base class for LLM providers.
// Subclasses implement createClient(), buildRequestParams(), and extractContent().
// The base class owns the streaming loop, cancellation checks, and streamUpdate
// messaging to the content script — eliminating the duplication that previously
// existed across processWithOpenAI, processWithAnthropic, and processWithOllama.

/**
 * @typedef {Object} ProviderContext
 * @property {string} apiKey
 * @property {string|null} endpoint
 * @property {string} model
 * @property {string} systemPrompt
 * @property {string} userPrompt
 * @property {string} text
 * @property {string|null} extraOptions
 * @property {boolean} isStreaming
 * @property {number} tabId
 * @property {string} streamId
 * @property {{ cancelled: boolean }} streamController
 */

export class BaseProvider {
    /**
     * Create the SDK client instance.
     * Must be implemented by subclasses.
     * @param {ProviderContext} context
     * @returns {Object} SDK client
     */
    createClient(context) {
        throw new Error('createClient() must be implemented by subclass');
    }

    /**
     * Build the request parameters object for the SDK call.
     * Must be implemented by subclasses.
     * @param {ProviderContext} context
     * @param {boolean} isStream - Whether the request should be a streaming request
     * @returns {Object} Request parameters
     */
    buildRequestParams(context, isStream) {
        throw new Error('buildRequestParams() must be implemented by subclass');
    }

    /**
     * Extract text content from a streaming chunk.
     * Must be implemented by subclasses.
     * @param {Object} chunk - A single chunk from the async iterator
     * @returns {string} Extracted text (may be empty)
     */
    extractContent(chunk) {
        throw new Error('extractContent() must be implemented by subclass');
    }

    /**
     * Extract text content from a non-streaming response.
     * Must be implemented by subclasses.
     * @param {Object} response - The SDK response object
     * @returns {string} Extracted text
     */
    extractResponseContent(response) {
        throw new Error('extractResponseContent() must be implemented by subclass');
    }

    /**
     * Execute the SDK request (streaming or non-streaming).
     * Default implementation calls client.chat.completions.create(params).
     * Subclasses can override if the SDK method differs (e.g. ollama.generate).
     * @param {Object} client - SDK client
     * @param {Object} params - Request parameters
     * @returns {Promise<Object|AsyncIterable>} Response or async iterable
     */
    async executeRequest(client, params) {
        return await client.chat.completions.create(params);
    }

    /**
     * Merge extra options (JSON string) into the base options object.
     * Critical fields in baseOptions (model, messages, etc.) are protected
     * from being overwritten by user-supplied extra options.
     * @param {Object} baseOptions - Options that must not be overwritten
     * @param {string|null} extraOptions - JSON string of user-supplied options
     * @returns {Object} Merged options
     */
    mergeExtraOptions(baseOptions, extraOptions) {
        if (!extraOptions) {
            return baseOptions;
        }

        let parsedExtraOptions = {};
        try {
            parsedExtraOptions = JSON.parse(extraOptions);
        } catch (error) {
            console.warn('Invalid extra options JSON, ignoring:', error);
            return baseOptions;
        }

        // Merge options, but don't overwrite critical fields like model
        return { ...parsedExtraOptions, ...baseOptions };
    }

    /**
     * Main entry point: process an LLM request (streaming or non-streaming).
     * Handles cancellation, streaming loop, and streamUpdate messaging.
     * @param {ProviderContext} context
     * @returns {Promise<string>} The full response text
     */
    async process(context) {
        const { isStreaming, streamController, extraOptions } = context;

        // Check if cancelled before making request
        if (streamController && streamController.cancelled) {
            throw new Error('Request cancelled');
        }

        const client = this.createClient(context);

        if (isStreaming) {
            return await this.processStream(client, context);
        } else {
            return await this.processComplete(client, context);
        }
    }

    /**
     * Handle a streaming request: iterate chunks, check cancellation,
     * and send streamUpdate messages to the content script.
     * @param {Object} client
     * @param {ProviderContext} context
     * @returns {Promise<string>} Full accumulated response
     */
    async processStream(client, context) {
        const { streamController, tabId, streamId, extraOptions } = context;

        const baseParams = this.buildRequestParams(context, true);
        const streamParams = this.mergeExtraOptions({ ...baseParams, stream: true }, extraOptions);
        const stream = await this.executeRequest(client, streamParams);

        let fullResponse = '';
        for await (const chunk of stream) {
            // Check if cancelled during streaming
            if (streamController && streamController.cancelled) {
                break;
            }

            const content = this.extractContent(chunk);
            if (content) {
                fullResponse += content;
                // Send update to content script with streamId
                browser.tabs.sendMessage(tabId, {
                    type: 'streamUpdate',
                    content: fullResponse,
                    streamId: streamId
                });
            }
        }
        return fullResponse;
    }

    /**
     * Handle a non-streaming request.
     * @param {Object} client
     * @param {ProviderContext} context
     * @returns {Promise<string>} Response text
     */
    async processComplete(client, context) {
        const { extraOptions } = context;

        const baseParams = this.buildRequestParams(context, false);
        const requestParams = this.mergeExtraOptions(baseParams, extraOptions);
        const response = await this.executeRequest(client, requestParams);
        return this.extractResponseContent(response);
    }
}
