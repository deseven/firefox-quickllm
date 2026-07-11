// Storage utilities for QuickLLM extension
// Consolidates browser storage operations and profile management

import {
    obfuscateProfileApiKeys,
    deobfuscateProfileApiKeys,
    profilesNeedMigration
} from './crypto-utils.js';
import { createProfilesUpdatedMessage } from '../core/messages.js';

/**
 * A configured LLM profile. Re-exported here so modules importing from
 * storage-utils can reference the profile shape.
 * @typedef {import('../content/types.js').Profile} Profile
 */

/**
 * Get data from browser storage with error handling
 * @param {string|string[]|Object} keys - Storage keys to retrieve
 * @returns {Promise<Object>} Storage data
 */
export async function getStorageData(keys) {
    try {
        return await browser.storage.local.get(keys);
    } catch (error) {
        console.error('Error getting storage data:', error);
        return {};
    }
}

/**
 * Set data in browser storage with error handling
 * @param {Object} data - Data to store
 * @returns {Promise<boolean>} Success status
 */
export async function setStorageData(data) {
    try {
        await browser.storage.local.set(data);
        return true;
    } catch (error) {
        console.error('Error setting storage data:', error);
        return false;
    }
}

/**
 * Load profiles from browser storage
 * @returns {Promise<Profile[]>} Array of profiles
 */
export async function loadProfiles() {
    try {
        const result = await getStorageData('profiles');
        const rawProfiles = /** @type {any} */ (result).profiles || [];

        // Deobfuscate API keys for in-memory use. Profiles saved after the
        // §3.1 security work carry an `enc:v1:` prefix; legacy plaintext keys
        // pass through unchanged.
        const profiles = deobfuscateProfileApiKeys(rawProfiles);

        // Seamlessly migrate any legacy plaintext keys to the obfuscated format
        // so storage never holds raw keys after the first load.
        if (profilesNeedMigration(rawProfiles)) {
            await setStorageData({ profiles: obfuscateProfileApiKeys(profiles) });
        }

        return profiles;
    } catch (error) {
        console.error('Error loading profiles:', error);
        return [];
    }
}

/**
 * Save profiles to browser storage and notify background script
 * @param {Profile[]} profiles - Array of profiles to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveProfiles(profiles) {
    try {
        // Obfuscate API keys before they hit storage so plaintext keys are
        // never persisted. In-memory callers continue to hold plaintext.
        const storedProfiles = obfuscateProfileApiKeys(profiles);
        const success = await setStorageData({ profiles: storedProfiles });
        if (success) {
            // Notify background script to update context menus
            await sendRuntimeMessage(createProfilesUpdatedMessage());
        }
        return success;
    } catch (error) {
        console.error('Error saving profiles:', error);
        return false;
    }
}

/**
 * Get a specific profile by ID
 * @param {string} profileId - Profile ID to find
 * @returns {Promise<Profile|null>} Profile object or null if not found
 */
export async function getProfileById(profileId) {
    const profiles = await loadProfiles();
    return profiles.find(p => p.id === profileId) || null;
}

/**
 * Add a new profile
 * @param {Profile} profileData - Profile data to add
 * @returns {Promise<boolean>} Success status
 */
export async function addProfile(profileData) {
    const profiles = await loadProfiles();
    profiles.push(profileData);
    return await saveProfiles(profiles);
}

/**
 * Update an existing profile
 * @param {string} profileId - Profile ID to update
 * @param {Partial<Profile>} profileData - New profile data (merged into existing)
 * @returns {Promise<boolean>} Success status
 */
export async function updateProfile(profileId, profileData) {
    const profiles = await loadProfiles();
    const index = profiles.findIndex(p => p.id === profileId);
    
    if (index !== -1) {
        profiles[index] = { ...profiles[index], ...profileData };
        return await saveProfiles(profiles);
    }
    
    return false;
}

/**
 * Delete a profile by ID
 * @param {string} profileId - Profile ID to delete
 * @returns {Promise<boolean>} Success status
 */
export async function deleteProfile(profileId) {
    const profiles = await loadProfiles();
    const filteredProfiles = profiles.filter(p => p.id !== profileId);
    
    if (filteredProfiles.length !== profiles.length) {
        return await saveProfiles(filteredProfiles);
    }
    
    return false;
}

/**
 * Get the current theme setting from storage
 * @returns {Promise<string>} Theme setting ('auto', 'light', or 'dark')
 */
export async function getThemeSetting() {
    try {
        const result = await getStorageData('themeSetting');
        return /** @type {any} */ (result).themeSetting || 'auto';
    } catch (error) {
        console.error('Error loading theme setting:', error);
        return 'auto';
    }
}

/**
 * Save theme setting to storage
 * @param {string} theme - Theme setting ('auto', 'light', or 'dark')
 * @returns {Promise<boolean>} Success status
 */
export async function saveThemeSetting(theme) {
    try {
        return await setStorageData({ themeSetting: theme });
    } catch (error) {
        console.error('Error saving theme setting:', error);
        return false;
    }
}

/**
 * Send message to runtime with error handling
 * @param {Object} message - Message to send
 * @returns {Promise<Object|null>} Response or null if failed
 */
export async function sendRuntimeMessage(message) {
    try {
        return await browser.runtime.sendMessage(message);
    } catch (error) {
        console.error('Error sending runtime message:', error);
        return null;
    }
}

/**
 * Get profiles with error handling and response format
 * @returns {Promise<{ profiles: Profile[], error: string|null }>} Response object with profiles array and optional error
 */
export async function getProfilesResponse() {
    try {
        const profiles = await loadProfiles();
        return { profiles, error: null };
    } catch (error) {
        console.error('Error getting profiles:', error);
        return { profiles: [], error: /** @type {Error} */ (error).message };
    }
}

/**
 * Validate profile data structure
 * @param {*} profile - Profile to validate
 * @returns {profile is Profile} True if valid
 */
export function validateProfile(profile) {
    return profile &&
           typeof profile.id === 'string' &&
           typeof profile.name === 'string' &&
           typeof profile.type === 'string' &&
           typeof profile.model === 'string' &&
           (typeof profile.apiKey === 'string' || profile.apiKey === null || profile.apiKey === undefined);
}

/**
 * Validate array of profiles
 * @param {*} profiles - Profiles array to validate
 * @returns {profiles is Profile[]} True if all profiles are valid
 */
export function validateProfiles(profiles) {
    return Array.isArray(profiles) && profiles.every(validateProfile);
}

/**
 * Generate a unique ID for profiles
 * @returns {string} Unique profile ID
 */
export function generateProfileId() {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Clone a profile with a new ID and modified name
 * @param {Profile} profile - Profile to clone
 * @param {string} [nameSuffix] - Suffix to add to name (default: ' (clone)')
 * @returns {Profile} Cloned profile
 */
export function cloneProfile(profile, nameSuffix = ' (clone)') {
    return {
        ...profile,
        id: generateProfileId(),
        name: profile.name + nameSuffix
    };
}

/**
 * Get extension manifest information
 * @returns {{ name: string, version: string, description: string }} Manifest data or fallback values
 */
export function getExtensionInfo() {
    try {
        const manifest = chrome.runtime.getManifest();
        return {
            name: manifest?.name || 'QuickLLM',
            version: manifest?.version || 'DEV',
            description: manifest?.description || ''
        };
    } catch (error) {
        console.warn('Could not load extension info:', error);
        return {
            name: 'QuickLLM',
            version: 'DEV',
            description: ''
        };
    }
}