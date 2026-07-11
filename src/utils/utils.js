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
    generateProfileId,
    generateProfileId as generateId,
    getExtensionInfo
} from './storage-utils.js';

// DOM utilities
export {
    createElement,
    clearElement,
    escapeHtml,
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

// Diff renderer
export { default as diffRenderer } from './diff-renderer.js';
export { DiffRenderer } from './diff-renderer.js';

/**
 * Get default endpoint for profile types that have one.
 * Delegates to the central provider-types registry so the default endpoints
 * are defined in a single place.
 * @param {string} type - Profile type (openrouter, together, deepseek, etc.)
 * @returns {string|null} Default endpoint URL or null if no default exists
 */
export { getDefaultEndpoint } from '../core/providers/provider-types.js';
