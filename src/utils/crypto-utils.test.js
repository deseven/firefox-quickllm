// Tests for crypto-utils.js — API key obfuscation, prefix handling, and
// legacy-plaintext migration detection
import { describe, it, expect, vi } from 'vitest';
import {
    OBFUSCATION_PREFIX,
    xorEncode,
    xorDecode,
    obfuscateApiKey,
    deobfuscateApiKey,
    isObfuscatedKey,
    obfuscateProfileApiKeys,
    deobfuscateProfileApiKeys,
    profilesNeedMigration
} from './crypto-utils.js';

describe('xorEncode / xorDecode', () => {
    it('round-trips a typical API key', () => {
        const key = 'sk-proj-abc123XYZ';
        expect(xorDecode(xorEncode(key))).toBe(key);
    });

    it('round-trips an empty string', () => {
        expect(xorDecode(xorEncode(''))).toBe('');
    });

    it('round-trips a key longer than the XOR key', () => {
        const key = 'a'.repeat(100);
        expect(xorDecode(xorEncode(key))).toBe(key);
    });

    it('produces a different string than the input', () => {
        const key = 'sk-secret';
        expect(xorEncode(key)).not.toBe(key);
    });

    it('xorDecode returns the input unchanged for invalid base64', () => {
        // xorDecode logs a warning on failure; suppress it to keep test output clean.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(xorDecode('!!!not-base64!!!')).toBe('!!!not-base64!!!');
        warnSpy.mockRestore();
    });
});

describe('obfuscateApiKey', () => {
    it('prefixes the encoded value with the obfuscation marker', () => {
        const result = obfuscateApiKey('sk-secret');
        expect(result.startsWith(OBFUSCATION_PREFIX)).toBe(true);
    });

    it('passes null through unchanged', () => {
        expect(obfuscateApiKey(null)).toBeNull();
    });

    it('passes undefined through unchanged', () => {
        expect(obfuscateApiKey(undefined)).toBeUndefined();
    });

    it('does not expose the plaintext in the output', () => {
        const result = obfuscateApiKey('sk-secret');
        expect(result).not.toContain('sk-secret');
    });
});

describe('deobfuscateApiKey', () => {
    it('reverses obfuscateApiKey', () => {
        const key = 'sk-proj-abc123XYZ';
        expect(deobfuscateApiKey(obfuscateApiKey(key))).toBe(key);
    });

    it('returns a legacy plaintext key unchanged (no prefix)', () => {
        expect(deobfuscateApiKey('sk-legacy-plaintext')).toBe('sk-legacy-plaintext');
    });

    it('passes null through unchanged', () => {
        expect(deobfuscateApiKey(null)).toBeNull();
    });

    it('passes undefined through unchanged', () => {
        expect(deobfuscateApiKey(undefined)).toBeUndefined();
    });
});

describe('isObfuscatedKey', () => {
    it('returns true for an obfuscated key', () => {
        expect(isObfuscatedKey(obfuscateApiKey('sk-secret'))).toBe(true);
    });

    it('returns false for a legacy plaintext key', () => {
        expect(isObfuscatedKey('sk-legacy')).toBe(false);
    });

    it('returns false for null', () => {
        expect(isObfuscatedKey(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isObfuscatedKey(undefined)).toBe(false);
    });
});

describe('obfuscateProfileApiKeys / deobfuscateProfileApiKeys', () => {
    const profiles = [
        { id: '1', name: 'A', type: 'openai', model: 'gpt-4', apiKey: 'sk-one' },
        { id: '2', name: 'B', type: 'ollama', model: 'llama3', apiKey: null },
        { id: '3', name: 'C', type: 'openai', model: 'gpt-4', apiKey: 'sk-three' }
    ];

    it('obfuscates only the apiKey field, leaving other fields intact', () => {
        const result = obfuscateProfileApiKeys(profiles);
        expect(result[0].id).toBe('1');
        expect(result[0].name).toBe('A');
        expect(isObfuscatedKey(result[0].apiKey)).toBe(true);
        expect(result[1].apiKey).toBeNull();
        expect(isObfuscatedKey(result[2].apiKey)).toBe(true);
    });

    it('does not mutate the input array', () => {
        const snapshot = JSON.stringify(profiles);
        obfuscateProfileApiKeys(profiles);
        expect(JSON.stringify(profiles)).toBe(snapshot);
    });

    it('round-trips through obfuscate then deobfuscate', () => {
        const restored = deobfuscateProfileApiKeys(obfuscateProfileApiKeys(profiles));
        expect(restored).toEqual(profiles);
    });

    it('deobfuscates legacy plaintext keys unchanged', () => {
        const legacy = [{ id: '1', apiKey: 'sk-legacy' }];
        const result = deobfuscateProfileApiKeys(legacy);
        expect(result[0].apiKey).toBe('sk-legacy');
    });

    it('returns non-array input unchanged', () => {
        expect(obfuscateProfileApiKeys(null)).toBeNull();
        expect(deobfuscateProfileApiKeys(undefined)).toBeUndefined();
    });
});

describe('profilesNeedMigration', () => {
    it('returns true when any profile has a legacy plaintext key', () => {
        const profiles = [
            { id: '1', apiKey: obfuscateApiKey('sk-ok') },
            { id: '2', apiKey: 'sk-legacy-plaintext' }
        ];
        expect(profilesNeedMigration(profiles)).toBe(true);
    });

    it('returns false when all keys are already obfuscated', () => {
        const profiles = [
            { id: '1', apiKey: obfuscateApiKey('sk-one') },
            { id: '2', apiKey: obfuscateApiKey('sk-two') }
        ];
        expect(profilesNeedMigration(profiles)).toBe(false);
    });

    it('returns false when all keys are null/undefined', () => {
        const profiles = [
            { id: '1', apiKey: null },
            { id: '2', apiKey: undefined }
        ];
        expect(profilesNeedMigration(profiles)).toBe(false);
    });

    it('returns false for an empty array', () => {
        expect(profilesNeedMigration([])).toBe(false);
    });

    it('returns false for a mixed set where only null keys are unmigrated', () => {
        const profiles = [
            { id: '1', apiKey: obfuscateApiKey('sk-ok') },
            { id: '2', apiKey: null }
        ];
        expect(profilesNeedMigration(profiles)).toBe(false);
    });

    it('returns false for non-array input', () => {
        expect(profilesNeedMigration(null)).toBe(false);
    });
});
