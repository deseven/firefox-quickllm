// Settings page for QuickLLM extension
import './settings.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';
import { applyTheme, loadProfiles, saveProfiles, getThemeSetting, saveThemeSetting, handleThemeChange, getThemeDisplayName, getExtensionInfo } from '../../utils/utils.js';

// Make bootstrap available globally for the HTML
window.bootstrap = bootstrap;

// Static encryption key (just to protect the api keys in the exported file)
const ENCRYPTION_KEY = 'Afo1ne7oot8Cemaicie7yeish8weiBie';

class SettingsManager {
    constructor() {
        this.profiles = [];
        this.init();
    }

    async init() {
        await applyTheme();
        this.profiles = await loadProfiles();
        await this.loadThemeSettings();
        await this.loadExtensionInfo();
        this.setupEventListeners();
    }

    async loadThemeSettings() {
        const currentTheme = await getThemeSetting();
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.value = currentTheme;
        }
    }

    async loadExtensionInfo() {
        const extensionInfo = getExtensionInfo();
        
        // Update the extension name in the DOM
        const nameElement = document.getElementById('extensionName');
        if (nameElement) {
            nameElement.textContent = extensionInfo.name;
        }
        
        // Update version
        const versionElement = document.getElementById('extensionVersion');
        if (versionElement) {
            versionElement.textContent = extensionInfo.version;
        }
        
        // Update license text
        const licenseElement = document.getElementById('licenseText');
        if (licenseElement && process.env.EXTENSION_LICENSE) {
            licenseElement.textContent = process.env.EXTENSION_LICENSE;
        }
    }

    async saveProfiles() {
        await saveProfiles(this.profiles);
    }

    setupEventListeners() {
        // Theme selector
        document.getElementById('themeSelector').addEventListener('change', (e) => {
            this.handleThemeChange(e.target.value);
        });

        // Export button
        document.getElementById('exportProfilesBtn').addEventListener('click', () => {
            this.exportProfiles();
        });

        // Import button
        document.getElementById('importProfilesBtn').addEventListener('click', () => {
            this.importProfiles();
        });

        // File input
        document.getElementById('importFileInput').addEventListener('change', (e) => {
            this.handleFileImport(e);
        });
    }

    async handleThemeChange(theme) {
        const success = await handleThemeChange(theme);
        if (success) {
            this.showStatus(`Theme changed to ${getThemeDisplayName(theme)}.`, 'success');
        } else {
            this.showStatus('Error saving theme setting. Please try again.', 'danger');
        }
    }

    // Simple XOR encryption/decryption
    encryptApiKey(apiKey) {
        if (!apiKey) return apiKey;
        let encrypted = '';
        for (let i = 0; i < apiKey.length; i++) {
            encrypted += String.fromCharCode(apiKey.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
        }
        return btoa(encrypted); // Base64 encode
    }

    decryptApiKey(encryptedApiKey) {
        if (!encryptedApiKey) return encryptedApiKey;
        try {
            const encrypted = atob(encryptedApiKey); // Base64 decode
            let decrypted = '';
            for (let i = 0; i < encrypted.length; i++) {
                decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
            }
            return decrypted;
        } catch (error) {
            console.warn('Failed to decrypt API key:', error);
            return encryptedApiKey; // Return as-is if decryption fails
        }
    }

    // Export profiles to JSON file
    async exportProfiles() {
        // Reload profiles from storage to get the latest changes
        this.profiles = await loadProfiles();
        
        if (this.profiles.length === 0) {
            this.showStatus('No profiles to export.', 'warning');
            return;
        }

        // Create a copy of profiles with encrypted API keys
        const exportProfiles = this.profiles.map(profile => ({
            ...profile,
            apiKey: this.encryptApiKey(profile.apiKey)
        }));

        const dataStr = JSON.stringify(exportProfiles, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `quickllm-profiles-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        this.showStatus(`Successfully exported ${this.profiles.length} profiles.`, 'success');
    }

    // Trigger file input for importing profiles
    importProfiles() {
        document.getElementById('importFileInput').click();
    }

    // Handle file import
    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            let importedProfiles;

            // Parse JSON
            try {
                importedProfiles = JSON.parse(text);
            } catch (e) {
                this.showStatus('Invalid JSON file. Please select a valid profiles export file.', 'danger');
                return;
            }

            // Validate that it's an array
            if (!Array.isArray(importedProfiles)) {
                this.showStatus('Invalid profiles file format. Expected an array of profiles.', 'danger');
                return;
            }

            // Basic validation of profile structure
            const isValidProfile = (profile) => {
                return profile && 
                       typeof profile.id === 'string' && 
                       typeof profile.name === 'string' && 
                       typeof profile.type === 'string' && 
                       typeof profile.model === 'string';
            };

            if (!importedProfiles.every(isValidProfile)) {
                this.showStatus('Invalid profiles file format. Some profiles are missing required fields.', 'danger');
                return;
            }

            // Confirm import
            const confirmMessage = `This will replace all current profiles (${this.profiles.length}) with ${importedProfiles.length} imported profiles. Continue?`;
            if (!confirm(confirmMessage)) {
                return;
            }

            // Decrypt API keys in imported profiles
            const decryptedProfiles = importedProfiles.map(profile => ({
                ...profile,
                apiKey: this.decryptApiKey(profile.apiKey)
            }));

            // Replace profiles
            this.profiles = decryptedProfiles;
            await this.saveProfiles();

            this.showStatus(`Successfully imported ${importedProfiles.length} profiles.`, 'success');

        } catch (error) {
            console.error('Error importing profiles:', error);
            this.showStatus('Error reading file. Please try again.', 'danger');
        }

        // Clear the file input
        event.target.value = '';
    }

    // Show status message
    showStatus(message, type = 'info') {
        const statusMessage = document.getElementById('statusMessage');
        const statusText = document.getElementById('statusText');
        
        statusMessage.className = `alert alert-${type}`;
        statusText.textContent = message;
        statusMessage.classList.remove('d-none');

        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                statusMessage.classList.add('d-none');
            }, 5000);
        }
    }
}

// Initialize settings manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});