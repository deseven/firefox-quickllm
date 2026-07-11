// Tests for profile-ui-utils.js — shared profile UI helpers extracted from
// extension.js and settings.js (ARCHITECTURE_REVIEW.md §2.1).
import { describe, it, expect } from 'vitest';
import { getProfileIcon, shouldDisplayEndpoint, getProfileModelText } from './profile-ui-utils.js';
import { PROVIDER_TYPES } from '../core/providers/provider-types.js';

describe('getProfileIcon', () => {
    it('returns the openai icon for an openai profile without a custom endpoint', () => {
        expect(getProfileIcon({ type: PROVIDER_TYPES.OPENAI })).toBe('bxl bx-openai');
    });

    it('returns the brain-circuit icon for an openai profile with a custom endpoint', () => {
        expect(getProfileIcon({ type: PROVIDER_TYPES.OPENAI, endpoint: 'https://custom.api/v1' }))
            .toBe('bx bx-brain-circuit');
    });

    it('returns the anthropic icon for an anthropic profile', () => {
        expect(getProfileIcon({ type: PROVIDER_TYPES.ANTHROPIC })).toBe('bxl bx-anthropic');
    });

    it('returns the brain-circuit icon for an openrouter profile', () => {
        expect(getProfileIcon({ type: PROVIDER_TYPES.OPENROUTER })).toBe('bx bx-brain-circuit');
    });

    it('returns the deepseek icon for a deepseek profile', () => {
        expect(getProfileIcon({ type: PROVIDER_TYPES.DEEPSEEK })).toBe('bxl bx-deepseek');
    });

    it('returns the ollama icon for an ollama profile', () => {
        expect(getProfileIcon({ type: PROVIDER_TYPES.OLLAMA })).toBe('bxl bx-ollama');
    });

    it('falls back to bxl bx-<type> for unknown types', () => {
        expect(getProfileIcon({ type: 'gemini' })).toBe('bxl bx-gemini');
    });
});

describe('shouldDisplayEndpoint', () => {
    it('returns false when the profile has no endpoint', () => {
        expect(shouldDisplayEndpoint({ type: PROVIDER_TYPES.OPENAI })).toBe(false);
        expect(shouldDisplayEndpoint({ type: PROVIDER_TYPES.OPENAI, endpoint: null })).toBe(false);
        expect(shouldDisplayEndpoint({ type: PROVIDER_TYPES.OPENAI, endpoint: '' })).toBe(false);
    });

    it('returns true for openai with a custom endpoint (no default exists)', () => {
        expect(shouldDisplayEndpoint({ type: PROVIDER_TYPES.OPENAI, endpoint: 'https://custom.api/v1' }))
            .toBe(true);
    });

    it('returns true for anthropic with a custom endpoint (no default exists)', () => {
        expect(shouldDisplayEndpoint({ type: PROVIDER_TYPES.ANTHROPIC, endpoint: 'https://my-anthropic.proxy' }))
            .toBe(true);
    });

    it('returns false when the endpoint matches the default for openrouter', () => {
        expect(shouldDisplayEndpoint({
            type: PROVIDER_TYPES.OPENROUTER,
            endpoint: 'https://openrouter.ai/api/v1'
        })).toBe(false);
    });

    it('returns true when the endpoint differs from the default for openrouter', () => {
        expect(shouldDisplayEndpoint({
            type: PROVIDER_TYPES.OPENROUTER,
            endpoint: 'https://custom.openrouter.proxy/v1'
        })).toBe(true);
    });

    it('returns false when the endpoint matches the default for together', () => {
        expect(shouldDisplayEndpoint({
            type: PROVIDER_TYPES.TOGETHER,
            endpoint: 'https://api.together.xyz/v1'
        })).toBe(false);
    });

    it('returns false when the endpoint matches the default for deepseek', () => {
        expect(shouldDisplayEndpoint({
            type: PROVIDER_TYPES.DEEPSEEK,
            endpoint: 'https://api.deepseek.com/v1'
        })).toBe(false);
    });

    it('returns true for an unknown type with an endpoint', () => {
        expect(shouldDisplayEndpoint({ type: 'gemini', endpoint: 'https://api.gemini.com' }))
            .toBe(true);
    });
});

describe('getProfileModelText', () => {
    it('returns just the model when the endpoint should not be displayed', () => {
        expect(getProfileModelText({ type: PROVIDER_TYPES.OPENAI, model: 'gpt-4' }))
            .toBe('gpt-4');
    });

    it('returns the model with the endpoint hostname when the endpoint is custom', () => {
        expect(getProfileModelText({
            type: PROVIDER_TYPES.OPENAI,
            model: 'gpt-4',
            endpoint: 'https://custom.api/v1'
        })).toBe('gpt-4 (custom.api)');
    });

    it('returns just the model when the endpoint matches the default', () => {
        expect(getProfileModelText({
            type: PROVIDER_TYPES.OPENROUTER,
            model: 'some-model',
            endpoint: 'https://openrouter.ai/api/v1'
        })).toBe('some-model');
    });

    it('returns the model with the endpoint hostname for a custom openrouter endpoint', () => {
        expect(getProfileModelText({
            type: PROVIDER_TYPES.OPENROUTER,
            model: 'some-model',
            endpoint: 'https://proxy.openrouter.example.com/v1'
        })).toBe('some-model (proxy.openrouter.example.com)');
    });
});
