// Tests for storage-utils.js — profile validation, ID generation, and the
// API key obfuscation/migration behaviour
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    validateProfile,
    validateProfiles,
    generateProfileId,
    loadProfiles,
    saveProfiles,
    getProfileById,
    addProfile,
    updateProfile,
    deleteProfile,
    cloneProfile,
    getProfilesResponse,
    getThemeSetting,
    saveThemeSetting,
    getExtensionInfo
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
        await saveProfiles([{ id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-x' }]);
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

// ---------------------------------------------------------------------------
// cloneProfile
// ---------------------------------------------------------------------------

describe('cloneProfile', () => {
    const baseProfile = {
        id: 'profile_original',
        name: 'Original',
        type: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-secret',
        systemPrompt: 'You are helpful.',
        endpoint: null,
        extraOptions: null,
        userPrompt: null,
        processImmediately: false,
        diffOutput: false
    };

    it('returns a new object with a different id', () => {
        const clone = cloneProfile(baseProfile);
        expect(clone.id).not.toBe(baseProfile.id);
        expect(typeof clone.id).toBe('string');
    });

    it('appends the default suffix to the name', () => {
        const clone = cloneProfile(baseProfile);
        expect(clone.name).toBe('Original (clone)');
    });

    it('appends a custom suffix when provided', () => {
        const clone = cloneProfile(baseProfile, ' (copy)');
        expect(clone.name).toBe('Original (copy)');
    });

    it('preserves all other profile fields', () => {
        const clone = cloneProfile(baseProfile);
        expect(clone.type).toBe('openai');
        expect(clone.model).toBe('gpt-4');
        expect(clone.apiKey).toBe('sk-secret');
        expect(clone.systemPrompt).toBe('You are helpful.');
    });

    it('does not mutate the original profile', () => {
        const snapshot = { ...baseProfile };
        cloneProfile(baseProfile);
        expect(baseProfile).toEqual(snapshot);
    });
});

// ---------------------------------------------------------------------------
// getProfileById
// ---------------------------------------------------------------------------

describe('getProfileById', () => {
    const storageGet = vi.mocked(browser.storage.local.get);

    beforeEach(() => {
        storageGet.mockReset();
    });

    it('returns the profile matching the id', async () => {
        const profiles = [
            { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-a' },
            { id: '2', name: 'B', type: 'ollama', model: 'llama3', apiKey: null }
        ];
        storageGet.mockResolvedValue({ profiles: profiles.map(p => ({
            ...p,
            apiKey: p.apiKey ? obfuscateApiKey(p.apiKey) : p.apiKey
        })) });

        const result = await getProfileById('2');
        expect(result).not.toBeNull();
        expect(result?.id).toBe('2');
        expect(result?.name).toBe('B');
    });

    it('returns null when the profile is not found', async () => {
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: obfuscateApiKey('sk-a') }
        ]});

        const result = await getProfileById('nonexistent');
        expect(result).toBeNull();
    });

    it('returns null when no profiles exist in storage', async () => {
        storageGet.mockResolvedValue({});

        const result = await getProfileById('1');
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// addProfile
// ---------------------------------------------------------------------------

describe('addProfile', () => {
    const storageGet = vi.mocked(browser.storage.local.get);
    const storageSet = vi.mocked(browser.storage.local.set);
    const runtimeSend = vi.mocked(browser.runtime.sendMessage);

    beforeEach(() => {
        storageGet.mockReset();
        storageSet.mockReset();
        runtimeSend.mockReset().mockResolvedValue(undefined);
    });

    it('appends the new profile to the existing list', async () => {
        const existing = [
            { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-a' }
        ];
        storageGet.mockResolvedValue({ profiles: existing.map(p => ({
            ...p,
            apiKey: obfuscateApiKey(/** @type {string} */ (p.apiKey))
        })) });

        const newProfile = { id: '2', name: 'B', type: 'ollama', model: 'llama3', apiKey: null };
        const result = await addProfile(newProfile);

        expect(result).toBe(true);
        const stored = storageSet.mock.calls[0][0].profiles;
        expect(stored).toHaveLength(2);
        expect(stored[1].id).toBe('2');
    });

    it('obfuscates the new profile\'s API key before storing', async () => {
        storageGet.mockResolvedValue({ profiles: [] });

        const newProfile = { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-new' };
        await addProfile(newProfile);

        const stored = storageSet.mock.calls[0][0].profiles;
        expect(isObfuscatedKey(stored[0].apiKey)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe('updateProfile', () => {
    const storageGet = vi.mocked(browser.storage.local.get);
    const storageSet = vi.mocked(browser.storage.local.set);
    const runtimeSend = vi.mocked(browser.runtime.sendMessage);

    beforeEach(() => {
        storageGet.mockReset();
        storageSet.mockReset();
        runtimeSend.mockReset().mockResolvedValue(undefined);
    });

    it('merges new data into the existing profile', async () => {
        const existing = [
            { id: '1', name: 'Old', type: 'openai', model: 'gpt-4', apiKey: 'sk-a' }
        ];
        storageGet.mockResolvedValue({ profiles: existing.map(p => ({
            ...p,
            apiKey: obfuscateApiKey(/** @type {string} */ (p.apiKey))
        })) });

        const result = await updateProfile('1', { name: 'New', model: 'gpt-4o' });

        expect(result).toBe(true);
        const stored = storageSet.mock.calls[0][0].profiles;
        expect(stored[0].name).toBe('New');
        expect(stored[0].model).toBe('gpt-4o');
        // Untouched fields are preserved
        expect(stored[0].type).toBe('openai');
    });

    it('returns false when the profile id is not found', async () => {
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: obfuscateApiKey('sk-a') }
        ]});

        const result = await updateProfile('nonexistent', { name: 'X' });
        expect(result).toBe(false);
        expect(storageSet).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// deleteProfile
// ---------------------------------------------------------------------------

describe('deleteProfile', () => {
    const storageGet = vi.mocked(browser.storage.local.get);
    const storageSet = vi.mocked(browser.storage.local.set);
    const runtimeSend = vi.mocked(browser.runtime.sendMessage);

    beforeEach(() => {
        storageGet.mockReset();
        storageSet.mockReset();
        runtimeSend.mockReset().mockResolvedValue(undefined);
    });

    it('removes the profile with the matching id', async () => {
        const existing = [
            { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-a' },
            { id: '2', name: 'B', type: 'ollama', model: 'llama3', apiKey: null }
        ];
        storageGet.mockResolvedValue({ profiles: existing.map(p => ({
            ...p,
            apiKey: p.apiKey ? obfuscateApiKey(/** @type {string} */ (p.apiKey)) : p.apiKey
        })) });

        const result = await deleteProfile('1');

        expect(result).toBe(true);
        const stored = storageSet.mock.calls[0][0].profiles;
        expect(stored).toHaveLength(1);
        expect(stored[0].id).toBe('2');
    });

    it('returns false when the profile id is not found', async () => {
        storageGet.mockResolvedValue({ profiles: [
            { id: '1', apiKey: obfuscateApiKey('sk-a') }
        ]});

        const result = await deleteProfile('nonexistent');
        expect(result).toBe(false);
        expect(storageSet).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getProfilesResponse
// ---------------------------------------------------------------------------

describe('getProfilesResponse', () => {
    const storageGet = vi.mocked(browser.storage.local.get);

    beforeEach(() => {
        storageGet.mockReset();
    });

    it('returns profiles with null error on success', async () => {
        const profiles = [
            { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-a' }
        ];
        storageGet.mockResolvedValue({ profiles: profiles.map(p => ({
            ...p,
            apiKey: obfuscateApiKey(/** @type {string} */ (p.apiKey))
        })) });

        const result = await getProfilesResponse();
        expect(result.error).toBeNull();
        expect(result.profiles).toHaveLength(1);
        expect(result.profiles[0].name).toBe('A');
    });

    it('returns an empty array when storage fails (loadProfiles swallows the error)', async () => {
        // loadProfiles has its own try/catch that returns [] on storage
        // errors, so getProfilesResponse receives an empty array with no
        // error rather than propagating the storage failure.
        storageGet.mockRejectedValue(new Error('storage exploded'));

        // Suppress the expected console.error from getStorageData's catch.
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const result = await getProfilesResponse();
            expect(result.profiles).toEqual([]);
            expect(result.error).toBeNull();
        } finally {
            errorSpy.mockRestore();
        }
    });
});

// ---------------------------------------------------------------------------
// getThemeSetting / saveThemeSetting
// ---------------------------------------------------------------------------

describe('getThemeSetting', () => {
    const storageGet = vi.mocked(browser.storage.local.get);

    beforeEach(() => {
        storageGet.mockReset();
    });

    it('returns the stored theme setting', async () => {
        storageGet.mockResolvedValue({ themeSetting: 'dark' });
        expect(await getThemeSetting()).toBe('dark');
    });

    it('defaults to "auto" when no setting is stored', async () => {
        storageGet.mockResolvedValue({});
        expect(await getThemeSetting()).toBe('auto');
    });
});

describe('saveThemeSetting', () => {
    const storageSet = vi.mocked(browser.storage.local.set);

    beforeEach(() => {
        storageSet.mockReset();
    });

    it('writes the theme setting to storage', async () => {
        const result = await saveThemeSetting('light');
        expect(result).toBe(true);
        expect(storageSet).toHaveBeenCalledWith({ themeSetting: 'light' });
    });
});

// ---------------------------------------------------------------------------
// getExtensionInfo
// ---------------------------------------------------------------------------

describe('getExtensionInfo', () => {
    afterEach(() => {
        // Clean up any chrome global we attach so tests don't leak.
        if (globalThis.chrome === undefined) {
            delete globalThis.chrome;
        }
    });

    it('returns manifest data when available', () => {
        // Provide a chrome.runtime.getManifest mock so the happy path is
        // exercised instead of the fallback.
        globalThis.chrome = {
            runtime: {
                getManifest: () => ({
                    name: 'QuickLLM',
                    version: '1.2.3',
                    description: 'A test description'
                })
            }
        };

        const result = getExtensionInfo();
        expect(result.name).toBe('QuickLLM');
        expect(result.version).toBe('1.2.3');
        expect(result.description).toBe('A test description');
    });

    it('falls back to defaults when chrome is unavailable', () => {
        // Ensure no chrome global is present so the catch path runs.
        delete globalThis.chrome;

        // Suppress the expected console.warn from the catch block.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const result = getExtensionInfo();
            expect(result.name).toBe('QuickLLM');
            expect(result.version).toBe('DEV');
            expect(result.description).toBe('');
        } finally {
            warnSpy.mockRestore();
        }
    });
});
