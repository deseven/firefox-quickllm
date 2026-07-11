// Ollama provider.
// Uses the official ollama/browser SDK. Unlike OpenAI/Anthropic, Ollama uses a
// single `generate` endpoint with a concatenated prompt string rather than a
// messages array.

import { Ollama } from 'ollama/browser';
import { BaseProvider } from './base-provider.js';

export class OllamaProvider extends BaseProvider {
    /**
     * Create the Ollama client.
     * Ollama runs locally and typically does not require an API key.
     */
    createClient(context) {
        const { endpoint } = context;
        return new Ollama({
            host: endpoint || 'http://localhost:11434'
        });
    }

    /**
     * Build the generate request parameters.
     * Ollama uses a single prompt string that concatenates system/user prompts.
     */
    buildRequestParams(context, isStream) {
        const { model, systemPrompt, userPrompt, text } = context;

        // Build the prompt with system prompt and user prompt if provided
        let prompt = '';
        if (systemPrompt) {
            prompt += systemPrompt + '\n\n';
        }
        if (userPrompt) {
            prompt += userPrompt + '\n\n';
        }
        prompt += text;

        return {
            model: model,
            prompt: prompt
        };
    }

    /**
     * Ollama uses client.generate() instead of client.chat.completions.create().
     */
    async executeRequest(client, params) {
        return await client.generate(params);
    }

    /**
     * Extract content from a streaming chunk.
     */
    extractContent(chunk) {
        return chunk.response || '';
    }

    /**
     * Extract content from a non-streaming response.
     */
    extractResponseContent(response) {
        return response.response;
    }
}
