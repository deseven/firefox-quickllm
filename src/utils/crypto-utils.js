// Crypto utilities for QuickLLM extension
//
// API keys are obfuscated in browser.storage.local using a simple XOR cipher
// with a static key, then Base64-encoded and prefixed with a version marker.
// This is NOT real encryption — the key lives in the source — but it prevents
// casual plaintext visibility in storage and keeps the approach consistent with
// the export/import obfuscation.
//
// The `enc:v1:` prefix lets us distinguish obfuscated keys from legacy
// plaintext keys stored before this feature existed, so migration is seamless.

/**
 * Static XOR key. Shared between storage obfuscation and export obfuscation so
 * the two stay consistent. Intended to be used simply to avoid storing keys as plain text.
 */
const XOR_KEY = 'Afo1ne7oot8Cemaicie7yeish8weiBie';

/**
 * Prefix marking an obfuscated API key. The `v1` segment leaves room for a
 * future format bump without colliding with legacy plaintext values.
 */
export const OBFUSCATION_PREFIX = 'enc:v1:';

/**
 * Raw XOR + Base64 encode. Used directly by the export flow so exported files
 * stay backward-compatible with older imports (no prefix in the file format).
 * @param {string} plaintext - The value to encode.
 * @returns {string} Base64-encoded XOR cipher text.
 */
export function xorEncode(plaintext) {
    let encoded = '';
    for (let i = 0; i < plaintext.length; i++) {
        encoded += String.fromCharCode(plaintext.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
    }
    return btoa(encoded);
}

/**
 * Raw XOR + Base64 decode. Inverse of {@link xorEncode}. Returns the input
 * unchanged if it cannot be decoded, so corrupt/legacy values degrade
 * gracefully rather than throwing.
 * @param {string} encoded - The Base64-encoded XOR cipher text.
 * @returns {string} Decrypted plaintext, or the original value on failure.
 */
export function xorDecode(encoded) {
    try {
        const raw = atob(encoded);
        let decoded = '';
        for (let i = 0; i < raw.length; i++) {
            decoded += String.fromCharCode(raw.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length));
        }
        return decoded;
    } catch (error) {
        console.warn('Failed to decode obfuscated value:', error);
        return encoded;
    }
}

/**
 * Obfuscate a single API key for storage. Null/undefined keys pass through
 * untouched so profiles without a key (e.g. local Ollama) are unaffected.
 * @param {string|null|undefined} apiKey - Plaintext API key.
 * @returns {string|null|undefined} Prefixed obfuscated value, or the input
 *   for null/undefined.
 */
export function obfuscateApiKey(apiKey) {
    if (apiKey === null || apiKey === undefined) return apiKey;
    return OBFUSCATION_PREFIX + xorEncode(apiKey);
}

/**
 * Deobfuscate a single API key read from storage. Values carrying the
 * {@link OBFUSCATION_PREFIX} are decrypted; any other non-null string is
 * treated as a legacy plaintext key and returned unchanged so migration is
 * transparent. Null/undefined passes through.
 * @param {string|null|undefined} storedKey - Stored (possibly obfuscated) key.
 * @returns {string|null|undefined} Plaintext API key.
 */
export function deobfuscateApiKey(storedKey) {
    if (storedKey === null || storedKey === undefined) return storedKey;
    if (storedKey.startsWith(OBFUSCATION_PREFIX)) {
        return xorDecode(storedKey.slice(OBFUSCATION_PREFIX.length));
    }
    return storedKey;
}

/**
 * Report whether a stored key value is already obfuscated.
 * @param {string|null|undefined} storedKey - Stored key value to inspect.
 * @returns {boolean} True when the value carries the obfuscation prefix.
 */
export function isObfuscatedKey(storedKey) {
    return typeof storedKey === 'string' && storedKey.startsWith(OBFUSCATION_PREFIX);
}

/**
 * Obfuscate the `apiKey` field of every profile in an array. Returns a new
 * array of shallow-copied profiles; the input is not mutated.
 * @param {Array<Object>} profiles - Profiles with plaintext apiKeys.
 * @returns {Array<Object>} Profiles with obfuscated apiKeys.
 */
export function obfuscateProfileApiKeys(profiles) {
    if (!Array.isArray(profiles)) return profiles;
    return profiles.map(profile => ({
        ...profile,
        apiKey: obfuscateApiKey(profile?.apiKey)
    }));
}

/**
 * Deobfuscate the `apiKey` field of every profile in an array. Returns a new
 * array of shallow-copied profiles; the input is not mutated.
 * @param {Array<Object>} profiles - Profiles with stored (obfuscated/legacy) apiKeys.
 * @returns {Array<Object>} Profiles with plaintext apiKeys.
 */
export function deobfuscateProfileApiKeys(profiles) {
    if (!Array.isArray(profiles)) return profiles;
    return profiles.map(profile => ({
        ...profile,
        apiKey: deobfuscateApiKey(profile?.apiKey)
    }));
}

/**
 * Detect whether any profile still holds a legacy plaintext (non-obfuscated)
 * API key and therefore needs to be re-saved in the obfuscated format.
 * @param {Array<Object>} profiles - Profiles as read from storage.
 * @returns {boolean} True when at least one profile needs migration.
 */
export function profilesNeedMigration(profiles) {
    if (!Array.isArray(profiles)) return false;
    return profiles.some(profile =>
        profile?.apiKey !== null &&
        profile?.apiKey !== undefined &&
        !isObfuscatedKey(profile?.apiKey)
    );
}
