// OpenAI-compatible provider.
// Handles all providers that use the OpenAI SDK's chat.completions API:
// openai, openrouter, together, and deepseek. They differ only in endpoint.

import OpenAI from 'openai';
import { BaseProvider } from './base-provider.js';

export class OpenAIProvider extends BaseProvider {
    /**
     * Create the OpenAI SDK client.
     * `dangerouslyAllowBrowser: true` is required because the SDK runs in the
     * extension background script (a browser context). This is safe here because
     * the key never reaches content scripts or page DOM.
     */
    createClient(context) {
        const { apiKey, endpoint } = context;
        return new OpenAI({
            apiKey: apiKey || 'dummy-key', // Some APIs don't require keys but OpenAI SDK requires a value
            baseURL: endpoint || undefined,
            dangerouslyAllowBrowser: true
        });
    }

    /**
     * Build the chat.completions request parameters.
     * Message array: optional system prompt, optional user prompt, then the text.
     */
    buildRequestParams(context, isStream) {
        const { model, systemPrompt, userPrompt, text } = context;

        const messages = [];

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        if (userPrompt) {
            messages.push({ role: 'user', content: userPrompt });
        }
        messages.push({ role: 'user', content: text });

        return {
            model: model,
            messages: messages
        };
    }

    /**
     * Extract content from a streaming chunk.
     */
    extractContent(chunk) {
        return chunk.choices?.[0]?.delta?.content || '';
    }

    /**
     * Extract content from a non-streaming response.
     */
    extractResponseContent(completion) {
        return completion.choices[0].message.content;
    }
}
