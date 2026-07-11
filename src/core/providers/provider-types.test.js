// Tests for provider-types.js — the central provider registry/metadata module.
import { describe, it, expect } from 'vitest';
import {
    PROVIDER_TYPES,
    PROVIDER_METADATA,
    getDefaultEndpoint,
    getProviderIcon,
    getProviderTypeList
} from './provider-types.js';

describe('PROVIDER_TYPES', () => {
    it('contains all expected provider type strings', () => {
        expect(PROVIDER_TYPES.OPENAI).toBe('openai');
        expect(PROVIDER_TYPES.OPENROUTER).toBe('openrouter');
        expect(PROVIDER_TYPES.TOGETHER).toBe('together');
        expect(PROVIDER_TYPES.DEEPSEEK).toBe('deepseek');
        expect(PROVIDER_TYPES.ANTHROPIC).toBe('anthropic');
        expect(PROVIDER_TYPES.OLLAMA).toBe('ollama');
    });

    it('is frozen (immutable)', () => {
        expect(Object.isFrozen(PROVIDER_TYPES)).toBe(true);
    });
});

describe('getDefaultEndpoint', () => {
    it('returns the correct default endpoint for openrouter', () => {
        expect(getDefaultEndpoint('openrouter')).toBe('https://openrouter.ai/api/v1');
    });

    it('returns the correct default endpoint for together', () => {
        expect(getDefaultEndpoint('together')).toBe('https://api.together.xyz/v1');
    });

    it('returns the correct default endpoint for deepseek', () => {
        expect(getDefaultEndpoint('deepseek')).toBe('https://api.deepseek.com/v1');
    });

    it('returns null for openai (no default endpoint)', () => {
        expect(getDefaultEndpoint('openai')).toBeNull();
    });

    it('returns null for anthropic (no default endpoint)', () => {
        expect(getDefaultEndpoint('anthropic')).toBeNull();
    });

    it('returns null for ollama (no default endpoint)', () => {
        expect(getDefaultEndpoint('ollama')).toBeNull();
    });

    it('returns null for an unknown provider type', () => {
        expect(getDefaultEndpoint('gemini')).toBeNull();
    });
});

describe('getProviderIcon', () => {
    it('returns the deepseek icon for deepseek', () => {
        expect(getProviderIcon('deepseek')).toBe('bxl bx-deepseek');
    });

    it('returns the brain-circuit icon for openrouter', () => {
        expect(getProviderIcon('openrouter')).toBe('bx bx-brain-circuit');
    });

    it('returns the brain-circuit icon for together', () => {
        expect(getProviderIcon('together')).toBe('bx bx-brain-circuit');
    });

    it('returns the openai icon for openai without a custom endpoint', () => {
        expect(getProviderIcon('openai')).toBe('bxl bx-openai');
        expect(getProviderIcon('openai', null)).toBe('bxl bx-openai');
    });

    it('returns the brain-circuit icon for openai with a custom endpoint', () => {
        expect(getProviderIcon('openai', 'https://custom.api/v1')).toBe('bx bx-brain-circuit');
    });

    it('returns the anthropic icon for anthropic', () => {
        expect(getProviderIcon('anthropic')).toBe('bxl bx-anthropic');
    });

    it('returns the ollama icon for ollama', () => {
        expect(getProviderIcon('ollama')).toBe('bxl bx-ollama');
    });

    it('falls back to bxl bx-<type> for unknown types', () => {
        expect(getProviderIcon('gemini')).toBe('bxl bx-gemini');
    });
});

describe('getProviderTypeList', () => {
    it('returns an array of all provider types', () => {
        const list = getProviderTypeList();
        expect(list).toHaveLength(6);
        expect(list).toContain('openai');
        expect(list).toContain('anthropic');
        expect(list).toContain('ollama');
        expect(list).toContain('openrouter');
        expect(list).toContain('together');
        expect(list).toContain('deepseek');
    });
});

describe('PROVIDER_METADATA', () => {
    it('has metadata for every provider type in the type list', () => {
        for (const type of getProviderTypeList()) {
            expect(PROVIDER_METADATA[type]).toBeDefined();
            expect(typeof PROVIDER_METADATA[type].label).toBe('string');
            expect(typeof PROVIDER_METADATA[type].icon).toBe('string');
        }
    });

    it('is frozen (immutable)', () => {
        expect(Object.isFrozen(PROVIDER_METADATA)).toBe(true);
    });
});
