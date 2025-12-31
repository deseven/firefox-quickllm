// Shared utility functions for QuickLLM extension
import markdownRenderer from './markdown-renderer.js';

/**
 * Get the current theme setting from storage
 * @returns {Promise<string>} Theme setting ('auto', 'light', or 'dark')
 */
export async function getThemeSetting() {
    try {
        const result = await browser.storage.local.get('themeSetting');
        return result.themeSetting || 'auto';
    } catch (error) {
        console.error('Error loading theme setting:', error);
        return 'auto';
    }
}

/**
 * Save theme setting to storage
 * @param {string} theme - Theme setting ('auto', 'light', or 'dark')
 * @returns {Promise<void>}
 */
export async function saveThemeSetting(theme) {
    try {
        await browser.storage.local.set({ themeSetting: theme });
    } catch (error) {
        console.error('Error saving theme setting:', error);
        throw error;
    }
}

/**
 * Apply theme based on user's preference or system setting
 */
export async function applyTheme() {
    const themeSetting = await getThemeSetting();
    
    // Remove existing theme classes
    document.body.classList.remove('dark-theme');
    
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
        document.body.classList.add('dark-theme');
    }
    
    // Only listen for system theme changes if theme is set to 'auto'
    if (themeSetting === 'auto') {
        // Listen for theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (e.matches) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
        });
    }
}

/**
 * Load profiles from browser storage
 * @returns {Promise<Array>} Array of profiles
 */
export async function loadProfiles() {
    try {
        const result = await browser.storage.local.get('profiles');
        return result.profiles || [];
    } catch (error) {
        console.error('Error loading profiles:', error);
        return [];
    }
}

/**
 * Save profiles to browser storage
 * @param {Array} profiles - Array of profiles to save
 * @returns {Promise<void>}
 */
export async function saveProfiles(profiles) {
    try {
        await browser.storage.local.set({ profiles: profiles });
        // Notify background script to update context menus
        browser.runtime.sendMessage({ type: 'profilesUpdated' });
    } catch (error) {
        console.error('Error saving profiles:', error);
        throw error;
    }
}

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
 * Check if dark theme should be used based on manual setting or system preference
 * @returns {Promise<boolean>} True if dark theme should be used
 */
export async function prefersDarkMode() {
    const themeSetting = await getThemeSetting();
    
    if (themeSetting === 'dark') {
        return true;
    } else if (themeSetting === 'light') {
        return false;
    } else { // 'auto'
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
}

/**
 * Render content as markdown and apply styling to an element
 * @param {string} content - Content to render as markdown
 * @param {HTMLElement} element - Element to render into
 */
export function renderMarkdownContent(content, element) {
    if (!element || !content) return;
    
    // Clear existing content
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
    
    const renderedContent = markdownRenderer.render(content);
    const parser = new DOMParser();
    const doc = parser.parseFromString(renderedContent, 'text/html');
    
    // Move all children from parsed document to target element
    const bodyChildren = Array.from(doc.body.childNodes);
    bodyChildren.forEach(child => {
        element.appendChild(child);
    });
    
    element.classList.add('markdown-content');
}