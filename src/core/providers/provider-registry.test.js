// Tests for provider-registry.js — the type-string-to-provider lookup.
import { describe, it, expect } from 'vitest';
import { getProvider, isSupportedProvider, getDefaultEndpoint } from './provider-registry.js';
import { PROVIDER_TYPES } from './provider-types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OllamaProvider } from './ollama-provider.js';

describe('getProvider', () => {
    it('returns an OpenAIProvider for openai', () => {
        const provider = getProvider(PROVIDER_TYPES.OPENAI);
        expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('returns an OpenAIProvider for openrouter', () => {
        const provider = getProvider(PROVIDER_TYPES.OPENROUTER);
        expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('returns an OpenAIProvider for together', () => {
        const provider = getProvider(PROVIDER_TYPES.TOGETHER);
        expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('returns an OpenAIProvider for deepseek', () => {
        const provider = getProvider(PROVIDER_TYPES.DEEPSEEK);
        expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('returns an AnthropicProvider for anthropic', () => {
        const provider = getProvider(PROVIDER_TYPES.ANTHROPIC);
        expect(provider).toBeInstanceOf(AnthropicProvider);
    });

    it('returns an OllamaProvider for ollama', () => {
        const provider = getProvider(PROVIDER_TYPES.OLLAMA);
        expect(provider).toBeInstanceOf(OllamaProvider);
    });

    it('returns null for an unknown provider type', () => {
        expect(getProvider('gemini')).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(getProvider(/** @type {any} */ (undefined))).toBeNull();
    });

    it('returns null for null', () => {
        expect(getProvider(/** @type {any} */ (null))).toBeNull();
    });

    it('returns the same singleton instance on repeated calls', () => {
        const a = getProvider(PROVIDER_TYPES.OPENAI);
        const b = getProvider(PROVIDER_TYPES.OPENAI);
        expect(a).toBe(b);
    });
});

describe('isSupportedProvider', () => {
    it('returns true for all registered types', () => {
        expect(isSupportedProvider(PROVIDER_TYPES.OPENAI)).toBe(true);
        expect(isSupportedProvider(PROVIDER_TYPES.OPENROUTER)).toBe(true);
        expect(isSupportedProvider(PROVIDER_TYPES.TOGETHER)).toBe(true);
        expect(isSupportedProvider(PROVIDER_TYPES.DEEPSEEK)).toBe(true);
        expect(isSupportedProvider(PROVIDER_TYPES.ANTHROPIC)).toBe(true);
        expect(isSupportedProvider(PROVIDER_TYPES.OLLAMA)).toBe(true);
    });

    it('returns false for unknown types', () => {
        expect(isSupportedProvider('gemini')).toBe(false);
        expect(isSupportedProvider('')).toBe(false);
        expect(isSupportedProvider(/** @type {any} */ (undefined))).toBe(false);
    });
});

describe('getDefaultEndpoint (re-exported from provider-types)', () => {
    it('returns the correct default for openrouter', () => {
        expect(getDefaultEndpoint(PROVIDER_TYPES.OPENROUTER)).toBe('https://openrouter.ai/api/v1');
    });

    it('returns null for openai', () => {
        expect(getDefaultEndpoint(PROVIDER_TYPES.OPENAI)).toBeNull();
    });
});
