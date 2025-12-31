// Theme utilities for QuickLLM extension
// Consolidates theme detection and application logic

import { getThemeSetting as getThemeSettingFromStorage, saveThemeSetting as saveThemeSettingToStorage } from './storage-utils.js';

// Re-export theme storage functions
export { getThemeSettingFromStorage as getThemeSetting, saveThemeSettingToStorage as saveThemeSetting };

/**
 * Check if dark theme should be used based on manual setting or system preference
 * @returns {Promise<boolean>} True if dark theme should be used
 */
export async function prefersDarkMode() {
    const themeSetting = await getThemeSettingFromStorage();
    
    if (themeSetting === 'dark') {
        return true;
    } else if (themeSetting === 'light') {
        return false;
    } else { // 'auto'
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
}

/**
 * Apply theme based on user's preference or system setting
 * @param {HTMLElement} targetElement - Element to apply theme to (default: document.body)
 * @returns {Promise<void>}
 */
export async function applyTheme(targetElement = document.body) {
    const themeSetting = await getThemeSettingFromStorage();
    
    // Remove existing theme classes
    targetElement.classList.remove('dark-theme');
    
    let shouldUseDark = false;
    
    if (themeSetting === 'dark') {
        shouldUseDark = true;
    } else if (themeSetting === 'light') {
        shouldUseDark = false;
    } else { // 'auto'
        // Detect if user prefers dark mode
        shouldUseDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (shouldUseDark) {
        targetElement.classList.add('dark-theme');
    }
    
    // Only listen for system theme changes if theme is set to 'auto'
    if (themeSetting === 'auto') {
        // Remove existing listener if any
        if (window._quickllmThemeListener) {
            window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window._quickllmThemeListener);
        }
        
        // Create new listener
        window._quickllmThemeListener = (e) => {
            if (e.matches) {
                targetElement.classList.add('dark-theme');
            } else {
                targetElement.classList.remove('dark-theme');
            }
        };
        
        // Listen for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window._quickllmThemeListener);
    }
}

/**
 * Handle theme change and apply it
 * @param {string} theme - New theme setting ('auto', 'light', or 'dark')
 * @param {HTMLElement} targetElement - Element to apply theme to (default: document.body)
 * @returns {Promise<boolean>} Success status
 */
export async function handleThemeChange(theme, targetElement = document.body) {
    try {
        const success = await saveThemeSettingToStorage(theme);
        if (success) {
            await applyTheme(targetElement);
        }
        return success;
    } catch (error) {
        console.error('Error handling theme change:', error);
        return false;
    }
}

/**
 * Get theme display name
 * @param {string} theme - Theme setting
 * @returns {string} Display name
 */
export function getThemeDisplayName(theme) {
    switch (theme) {
        case 'auto':
            return 'Auto (System)';
        case 'light':
            return 'Light';
        case 'dark':
            return 'Dark';
        default:
            return 'Unknown';
    }
}

/**
 * Get appropriate colors for current theme
 * @param {boolean} isDark - Whether dark theme is active
 * @returns {Object} Color scheme object
 */
export function getThemeColors(isDark) {
    if (isDark) {
        return {
            background: '#1a1a1a',
            surface: '#2a2a2a',
            text: '#ffffff',
            textMuted: '#aaa',
            border: '#444',
            primary: '#007bff',
            success: '#28a745',
            danger: '#dc3545',
            warning: '#ffc107'
        };
    } else {
        return {
            background: '#ffffff',
            surface: '#f8f9fa',
            text: '#212529',
            textMuted: '#666',
            border: '#e5e5e5',
            primary: '#007bff',
            success: '#28a745',
            danger: '#dc3545',
            warning: '#ffc107'
        };
    }
}

/**
 * Apply theme-specific styles to an element
 * @param {HTMLElement} element - Element to style
 * @param {boolean} isDark - Whether dark theme is active
 * @param {Object} styleMap - Map of style properties to apply
 */
export function applyThemeStyles(element, isDark, styleMap) {
    if (!element || !styleMap) return;
    
    const colors = getThemeColors(isDark);
    
    Object.entries(styleMap).forEach(([property, colorKey]) => {
        if (colors[colorKey]) {
            element.style[property] = colors[colorKey];
        }
    });
}

/**
 * Create theme-aware CSS custom properties
 * @param {boolean} isDark - Whether dark theme is active
 * @returns {string} CSS custom properties string
 */
export function createThemeCustomProperties(isDark) {
    const colors = getThemeColors(isDark);
    
    return Object.entries(colors)
        .map(([key, value]) => `--theme-${key}: ${value};`)
        .join(' ');
}

/**
 * Initialize theme system for a page
 * @param {HTMLElement} targetElement - Element to apply theme to (default: document.body)
 * @returns {Promise<void>}
 */
export async function initializeTheme(targetElement = document.body) {
    await applyTheme(targetElement);
    
    // Add theme custom properties to document root
    const isDark = await prefersDarkMode();
    const customProperties = createThemeCustomProperties(isDark);
    document.documentElement.style.cssText += customProperties;
}

/**
 * Cleanup theme listeners (call when page unloads)
 */
export function cleanupThemeListeners() {
    if (window._quickllmThemeListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', window._quickllmThemeListener);
        delete window._quickllmThemeListener;
    }
}