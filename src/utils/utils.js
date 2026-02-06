// Shared utility functions for QuickLLM extension
// Re-exports from specialized utility modules for backward compatibility

// Theme utilities
export {
    getThemeSetting,
    saveThemeSetting,
    applyTheme,
    prefersDarkMode,
    handleThemeChange,
    getThemeDisplayName
} from './theme-utils.js';

// Storage utilities
export {
    loadProfiles,
    saveProfiles,
    getStorageData,
    setStorageData,
    getProfileById,
    addProfile,
    updateProfile,
    deleteProfile,
    sendRuntimeMessage,
    getProfilesResponse,
    validateProfile,
    validateProfiles,
    getExtensionInfo
} from './storage-utils.js';

// DOM utilities
export {
    createElement,
    clearElement,
    renderMarkdownToElement,
    renderMarkdownToElement as renderMarkdownContent,
    createLoadingElement,
    createBootstrapLoadingElement,
    showLoadingState,
    createErrorElement,
    showErrorState,
    addEventListenerWithCleanup,
    createButton,
    createFormGroup,
    toggleElementVisibility,
    formatEndpointForDisplay,
    copyToClipboardWithFeedback
} from './dom-utils.js';

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Generate a unique ID for profiles
 * @returns {string} Unique profile ID
 */
export function generateId() {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get default endpoint for profile types that have one
 * @param {string} type - Profile type (openrouter, together, deepseek, etc.)
 * @returns {string|null} Default endpoint URL or null if no default exists
 */
export function getDefaultEndpoint(type) {
    const defaultEndpoints = {
        'openrouter': 'https://openrouter.ai/api/v1',
        'together': 'https://api.together.xyz/v1',
        'deepseek': 'https://api.deepseek.com/v1'
    };
    return defaultEndpoints[type] || null;
}