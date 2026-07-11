// Tests for storage-utils.js — profile validation, ID generation, and the
// API key obfuscation/migration behaviour
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    validateProfile,
    validateProfiles,
    generateProfileId,
    loadProfiles,
    saveProfiles
} from './storage-utils.js';
import { isObfuscatedKey, deobfuscateApiKey, obfuscateApiKey } from './crypto-utils.js';

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

describe('saveProfiles / loadProfiles obfuscation', () => {
    const storageGet = vi.mocked(browser.storage.local.get);
    const storageSet = vi.mocked(browser.storage.local.set);
    const runtimeSend = vi.mocked(browser.runtime.sendMessage);

    beforeEach(() => {
        storageGet.mockReset();
        storageSet.mockReset();
        runtimeSend.mockReset().mockResolvedValue(undefined);
    });

    it('saveProfiles writes obfuscated API keys to storage', async () => {
        const profiles = [
            { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-secret' },
            { id: '2', name: 'B', type: 'ollama', model: 'llama3', apiKey: null }
        ];

        await saveProfiles(profiles);

        const stored = storageSet.mock.calls[0][0].profiles;
        expect(isObfuscatedKey(stored[0].apiKey)).toBe(true);
        expect(stored[0].apiKey).not.toContain('sk-secret');
        // null keys stay null
        expect(stored[1].apiKey).toBeNull();
        // non-apiKey fields are preserved
        expect(stored[0].name).toBe('A');
    });

    it('saveProfiles notifies the background script on success', async () => {
        await saveProfiles([{ id: '1', apiKey: 'sk-x' }]);
        expect(runtimeSend).toHaveBeenCalledWith({ type: 'profilesUpdated' });
    });

    it('loadProfiles returns plaintext keys when storage holds obfuscated values', async () => {
        const plaintext = 'sk-my-key';
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: obfuscateApiKey(plaintext) }
        ]});

        const result = await loadProfiles();
        expect(result[0].apiKey).toBe(plaintext);
    });

    it('loadProfiles returns [] when no profiles exist', async () => {
        storageGet.mockResolvedValue({});
        const result = await loadProfiles();
        expect(result).toEqual([]);
    });

    it('loadProfiles round-trips through saveProfiles', async () => {
        const original = [
            { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-roundtrip' },
            { id: '2', name: 'B', type: 'ollama', model: 'llama3', apiKey: null }
        ];

        await saveProfiles(original);
        const stored = storageSet.mock.calls[0][0].profiles;
        storageGet.mockResolvedValue({ profiles: stored });

        const loaded = await loadProfiles();
        expect(loaded).toEqual(original);
    });
});

describe('loadProfiles legacy migration', () => {
    const storageGet = vi.mocked(browser.storage.local.get);
    const storageSet = vi.mocked(browser.storage.local.set);

    beforeEach(() => {
        storageGet.mockReset();
        storageSet.mockReset();
    });

    it('returns legacy plaintext keys unchanged in memory', async () => {
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: 'sk-legacy-plaintext' }
        ]});

        const result = await loadProfiles();
        expect(result[0].apiKey).toBe('sk-legacy-plaintext');
    });

    it('re-writes storage with obfuscated keys when legacy keys are present', async () => {
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-legacy' }
        ]});

        await loadProfiles();

        expect(storageSet).toHaveBeenCalledTimes(1);
        const migrated = storageSet.mock.calls[0][0].profiles;
        expect(isObfuscatedKey(migrated[0].apiKey)).toBe(true);
        // The re-written key must decode back to the original plaintext.
        expect(deobfuscateApiKey(migrated[0].apiKey)).toBe('sk-legacy');
    });

    it('does not re-write storage when all keys are already obfuscated', async () => {
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: obfuscateApiKey('sk-ok') }
        ]});

        await loadProfiles();
        expect(storageSet).not.toHaveBeenCalled();
    });

    it('does not re-write storage when all keys are null', async () => {
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: null },
            { id: '2', apiKey: undefined }
        ]});

        await loadProfiles();
        expect(storageSet).not.toHaveBeenCalled();
    });

    it('migrates a mixed set and leaves already-obfuscated keys intact', async () => {
        const obfuscated = obfuscateApiKey('sk-already');
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: 'sk-legacy' },
            { id: '2', apiKey: obfuscated },
            { id: '3', apiKey: null }
        ]});

        const result = await loadProfiles();
        expect(result[0].apiKey).toBe('sk-legacy');
        expect(result[1].apiKey).toBe('sk-already');
        expect(result[2].apiKey).toBeNull();

        const migrated = storageSet.mock.calls[0][0].profiles;
        expect(isObfuscatedKey(migrated[0].apiKey)).toBe(true);
        expect(migrated[1].apiKey).toBe(obfuscated);
        expect(migrated[2].apiKey).toBeNull();
    });
});
