// Tests for storage-utils.js — profile validation and ID generation.
// These cover the logic touched during the §2.2 (generateId consolidation)
// and §2.4 (unified profile validation) deduplication work.
import { describe, it, expect } from 'vitest';
import { validateProfile, validateProfiles, generateProfileId } from './storage-utils.js';

describe('validateProfile', () => {
    const validProfile = {
        id: 'profile_1',
        name: 'My Profile',
        type: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-secret'
    };

    it('returns true for a fully valid profile', () => {
        expect(validateProfile(validProfile)).toBe(true);
    });

    it('returns true when apiKey is null', () => {
        expect(validateProfile({ ...validProfile, apiKey: null })).toBe(true);
    });

    it('returns true when apiKey is undefined (imported profiles)', () => {
        const { apiKey, ...withoutKey } = validProfile;
        expect(validateProfile(withoutKey)).toBe(true);
    });

    it('returns false when id is missing', () => {
        expect(validateProfile({ name: 'x', type: 'openai', model: 'gpt-4' })).toBe(false);
    });

    it('returns false when id is not a string', () => {
        expect(validateProfile({ ...validProfile, id: 123 })).toBe(false);
    });

    it('returns false when name is missing', () => {
        expect(validateProfile({ id: 'x', type: 'openai', model: 'gpt-4' })).toBe(false);
    });

    it('returns false when type is missing', () => {
        expect(validateProfile({ id: 'x', name: 'x', model: 'gpt-4' })).toBe(false);
    });

    it('returns false when model is missing', () => {
        expect(validateProfile({ id: 'x', name: 'x', type: 'openai' })).toBe(false);
    });

    it('returns false when apiKey is a number', () => {
        expect(validateProfile({ ...validProfile, apiKey: 123 })).toBe(false);
    });

    it('returns a falsy value for null', () => {
        expect(validateProfile(null)).toBeFalsy();
    });

    it('returns a falsy value for undefined', () => {
        expect(validateProfile(undefined)).toBeFalsy();
    });

    it('returns false for an empty object', () => {
        expect(validateProfile({})).toBe(false);
    });
});

describe('validateProfiles', () => {
    it('returns true for an empty array', () => {
        expect(validateProfiles([])).toBe(true);
    });

    it('returns true when all profiles are valid', () => {
        const profiles = [
            { id: '1', name: 'a', type: 'openai', model: 'gpt-4', apiKey: 'k' },
            { id: '2', name: 'b', type: 'anthropic', model: 'claude', apiKey: null }
        ];
        expect(validateProfiles(profiles)).toBe(true);
    });

    it('returns false when any profile is invalid', () => {
        const profiles = [
            { id: '1', name: 'a', type: 'openai', model: 'gpt-4', apiKey: 'k' },
            { id: '2', name: 'b', type: 'anthropic' }
        ];
        expect(validateProfiles(profiles)).toBe(false);
    });

    it('returns false for a non-array', () => {
        expect(validateProfiles(null)).toBe(false);
        expect(validateProfiles(undefined)).toBe(false);
        expect(validateProfiles({})).toBe(false);
        expect(validateProfiles('not an array')).toBe(false);
    });
});

describe('generateProfileId', () => {
    it('returns a string starting with "profile_"', () => {
        expect(generateProfileId().startsWith('profile_')).toBe(true);
    });

    it('returns a unique value on each call', () => {
        const ids = new Set();
        for (let i = 0; i < 100; i++) {
            ids.add(generateProfileId());
        }
        expect(ids.size).toBe(100);
    });

    it('contains a timestamp and random component', () => {
        const id = generateProfileId();
        // Format: profile_<timestamp>_<random>
        const parts = id.split('_');
        expect(parts).toHaveLength(3);
        expect(parts[0]).toBe('profile');
        expect(parts[1]).toMatch(/^\d+$/);
        expect(parts[2].length).toBeGreaterThanOrEqual(9);
    });
});
