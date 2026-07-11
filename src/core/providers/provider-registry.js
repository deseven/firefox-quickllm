// Provider registry: maps provider type strings to provider instances.
// This is the single lookup point used by the background script to dispatch
// an LLM request to the correct provider. Adding a new provider only requires
// registering it here — no changes to processWithLLM or the background script.

import { PROVIDER_TYPES, getDefaultEndpoint } from './provider-types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { BaseProvider } from './base-provider.js';

// Singleton provider instances. Providers are stateless (all per-request
// state lives in the ProviderContext passed to process()), so a single
// instance per type is safe to reuse across requests.
/** @type {Record<string, BaseProvider>} */
const providers = {
    [PROVIDER_TYPES.OPENAI]: new OpenAIProvider(),
    [PROVIDER_TYPES.OPENROUTER]: new OpenAIProvider(),
    [PROVIDER_TYPES.TOGETHER]: new OpenAIProvider(),
    [PROVIDER_TYPES.DEEPSEEK]: new OpenAIProvider(),
    [PROVIDER_TYPES.ANTHROPIC]: new AnthropicProvider(),
    [PROVIDER_TYPES.OLLAMA]: new OllamaProvider()
};

/**
 * Get the provider instance for a given type string.
 * @param {string} type - Provider type string (e.g. 'openai', 'anthropic')
 * @returns {BaseProvider|null} Provider instance, or null if type is unknown
 */
export function getProvider(type) {
    return providers[type] || null;
}

/**
 * Check whether a provider type is registered/supported.
 * @param {string} type
 * @returns {boolean}
 */
export function isSupportedProvider(type) {
    return type in providers;
}

// Re-export getDefaultEndpoint so background.js can import everything
// provider-related from a single module.
export { getDefaultEndpoint };
