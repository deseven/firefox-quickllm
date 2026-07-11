// Anthropic (Claude) provider.
// Uses the official @anthropic-ai/sdk. The system prompt is passed as a
// top-level `system` field rather than as a message, per the Anthropic API.

import Anthropic from '@anthropic-ai/sdk';
import { BaseProvider } from './base-provider.js';

export class AnthropicProvider extends BaseProvider {
    /**
     * Create the Anthropic SDK client.
     * `dangerouslyAllowBrowser: true` is required because the SDK runs in the
     * extension background script (a browser context). This is safe here because
     * the key never reaches content scripts or page DOM.
     * @param {import('./base-provider.js').ProviderContext} context
     * @returns {any}
     */
    createClient(context) {
        const { apiKey, endpoint } = context;
        return new Anthropic({
            apiKey: apiKey || 'dummy-key', // Some APIs don't require keys but Anthropic SDK requires a value
            baseURL: endpoint || undefined,
            dangerouslyAllowBrowser: true
        });
    }

    /**
     * Build the messages.create request parameters.
     * Anthropic requires max_tokens and uses a top-level `system` field.
     * @param {import('./base-provider.js').ProviderContext} context
     * @param {boolean} isStream
     * @returns {any}
     */
    buildRequestParams(context, isStream) {
        const { model, systemPrompt, userPrompt, text } = context;

        const messages = [];

        // User prompt (if defined)
        if (userPrompt) {
            messages.push({ role: 'user', content: userPrompt });
        }

        // Text to process becomes user message
        messages.push({ role: 'user', content: text });

        /** @type {any} */
        const baseOptions = {
            model: model,
            messages: messages,
            max_tokens: 4096  // Required by Anthropic API
        };

        // System prompt is a top-level field, not a message
        if (systemPrompt) {
            baseOptions.system = systemPrompt;
        }

        return baseOptions;
    }

    /**
     * Execute the SDK request using client.messages.create().
     * The Anthropic SDK uses a `messages` namespace, not `chat.completions`.
     * @param {any} client - Anthropic SDK client
     * @param {any} params - Request parameters
     * @returns {Promise<any>}
     */
    async executeRequest(client, params) {
        return await client.messages.create(params);
    }

    /**
     * Extract content from a streaming chunk.
     * Anthropic streams content_block_delta events with text in delta.text.
     * @param {any} chunk
     * @returns {string}
     */
    extractContent(chunk) {
        if (chunk.type === 'content_block_delta') {
            return chunk.delta.text || '';
        }
        return '';
    }

    /**
     * Extract content from a non-streaming response.
     * @param {any} message
     * @returns {string}
     */
    extractResponseContent(message) {
        return message.content[0].text;
    }
}
