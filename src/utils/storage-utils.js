// Storage utilities for QuickLLM extension
// Consolidates browser storage operations and profile management

/**
 * Get data from browser storage with error handling
 * @param {string|Array|Object} keys - Storage keys to retrieve
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
 * @returns {Promise<Array>} Array of profiles
 */
export async function loadProfiles() {
    try {
        const result = await getStorageData('profiles');
        return result.profiles || [];
    } catch (error) {
        console.error('Error loading profiles:', error);
        return [];
    }
}

/**
 * Save profiles to browser storage and notify background script
 * @param {Array} profiles - Array of profiles to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveProfiles(profiles) {
    try {
        const success = await setStorageData({ profiles: profiles });
        if (success) {
            // Notify background script to update context menus
            await sendRuntimeMessage({ type: 'profilesUpdated' });
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
 * @returns {Promise<Object|null>} Profile object or null if not found
 */
export async function getProfileById(profileId) {
    const profiles = await loadProfiles();
    return profiles.find(p => p.id === profileId) || null;
}

/**
 * Add a new profile
 * @param {Object} profileData - Profile data to add
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
 * @param {Object} profileData - New profile data
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
        return result.themeSetting || 'auto';
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
 * @returns {Promise<Object>} Response object with profiles array and optional error
 */
export async function getProfilesResponse() {
    try {
        const profiles = await loadProfiles();
        return { profiles, error: null };
    } catch (error) {
        console.error('Error getting profiles:', error);
        return { profiles: [], error: error.message };
    }
}

/**
 * Validate profile data structure
 * @param {Object} profile - Profile to validate
 * @returns {boolean} True if valid
 */
export function validateProfile(profile) {
    return profile && 
           typeof profile.id === 'string' && 
           typeof profile.name === 'string' && 
           typeof profile.type === 'string' && 
           typeof profile.model === 'string' &&
           typeof profile.apiKey === 'string';
}

/**
 * Validate array of profiles
 * @param {Array} profiles - Profiles array to validate
 * @returns {boolean} True if all profiles are valid
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
 * @param {Object} profile - Profile to clone
 * @param {string} nameSuffix - Suffix to add to name (default: ' (clone)')
 * @returns {Object} Cloned profile
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
 * @returns {Object} Manifest data or fallback values
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