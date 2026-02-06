// Settings page for QuickLLM extension
import './settings.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';
import Sortable from 'sortablejs';
import { applyTheme, loadProfiles, saveProfiles, getThemeSetting, saveThemeSetting, handleThemeChange, getThemeDisplayName, getExtensionInfo, generateId, clearElement, formatEndpointForDisplay, getDefaultEndpoint } from '../../utils/utils.js';

// Make bootstrap available globally for the HTML
window.bootstrap = bootstrap;

// Static encryption key (just to protect the api keys in the exported file)
const ENCRYPTION_KEY = 'Afo1ne7oot8Cemaicie7yeish8weiBie';

class SettingsManager {
    constructor() {
        this.profiles = [];
        this.sortable = null;
        this.statusTimeout = null;
        this.init();
    }

    async init() {
        await applyTheme();
        this.profiles = await loadProfiles();
        await this.loadThemeSettings();
        await this.loadExtensionInfo();
        this.setupEventListeners();
        this.setupTabs();
        this.setupSortable();
        this.renderProfiles();
        this.handleHashNavigation();
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

        // Add profile buttons
        document.getElementById('addProfileBtn').addEventListener('click', () => {
            this.navigateToEditPage();
        });
        
        document.getElementById('addFirstProfileBtn').addEventListener('click', () => {
            this.navigateToEditPage();
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

    setupTabs() {
        // Get all tab buttons
        const tabButtons = document.querySelectorAll('[data-tab]');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.currentTarget.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabId) {
        // Remove active class from all tabs and panes
        const allTabButtons = document.querySelectorAll('[data-tab]');
        const allTabPanes = document.querySelectorAll('.tab-pane');
        
        allTabButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });
        
        allTabPanes.forEach(pane => {
            pane.classList.remove('show', 'active');
        });
        
        // Add active class to selected tab and pane
        const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);
        const selectedPane = document.getElementById(tabId);
        
        if (selectedButton && selectedPane) {
            selectedButton.classList.add('active');
            selectedButton.setAttribute('aria-selected', 'true');
            selectedPane.classList.add('show', 'active');
        }
    }

    handleHashNavigation() {
        // Check if there's a hash in the URL to activate a specific tab
        const hash = window.location.hash.substring(1); // Remove the '#'
        if (hash) {
            // Handle notification hashes
            if (hash === 'profile-created') {
                this.switchTab('profiles');
                this.showStatus('Profile created successfully.', 'success');
                // Clean up the hash
                window.history.replaceState(null, '', 'settings.html#profiles');
            } else if (hash === 'profile-edited') {
                this.switchTab('profiles');
                this.showStatus('Profile updated successfully.', 'success');
                // Clean up the hash
                window.history.replaceState(null, '', 'settings.html#profiles');
            } else {
                // Regular tab navigation
                this.switchTab(hash);
            }
        }
    }

    setupSortable() {
        const profilesList = document.getElementById('profilesList');
        this.sortable = Sortable.create(profilesList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            onEnd: (evt) => {
                // Reorder profiles array
                const item = this.profiles.splice(evt.oldIndex, 1)[0];
                this.profiles.splice(evt.newIndex, 0, item);
                this.saveProfiles();
            }
        });
    }

    renderProfiles() {
        const profilesList = document.getElementById('profilesList');
        const emptyState = document.getElementById('emptyState');

        if (this.profiles.length === 0) {
            clearElement(profilesList);
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        clearElement(profilesList);
        
        // Create profile items
        this.profiles.forEach((profile) => {
            const profileItem = this.createProfileElement(profile);
            profilesList.appendChild(profileItem);
        });
    }

    getProfileIcon(profile) {
        const type = profile.type;
        const endpoint = profile.endpoint;

        if (type === 'deepseek') {
            return 'bxl bx-deepseek';
        }

        if (type === 'openrouter' || type === 'together') {
            return 'bx bx-brain-circuit';
        }

        if (type === 'openai' && endpoint) {
            return 'bx bx-brain-circuit';
        }

        return `bxl bx-${type}`;
    }

    shouldDisplayEndpoint(profile) {
        if (!profile.endpoint) {
            return false;
        }
        const defaultEndpoint = getDefaultEndpoint(profile.type);
        return !defaultEndpoint || profile.endpoint !== defaultEndpoint;
    }

    createProfileElement(profile) {
        // Create main profile item container
        const profileItem = document.createElement('div');
        profileItem.className = 'profile-item';
        profileItem.setAttribute('data-profile-id', profile.id);

        // Create profile header
        const profileHeader = document.createElement('div');
        profileHeader.className = 'profile-header';

        const dragHandle = document.createElement('i');
        dragHandle.className = 'bx bx-menu drag-handle';

        const profileName = document.createElement('h6');
        profileName.className = 'profile-name';
        profileName.textContent = profile.name;

        const profileType = document.createElement('span');
        profileType.className = `profile-type ${profile.type}`;
        const typeIcon = document.createElement('i');
        typeIcon.className = this.getProfileIcon(profile);
        profileType.appendChild(typeIcon);

        profileHeader.appendChild(dragHandle);
        profileHeader.appendChild(profileName);
        profileHeader.appendChild(profileType);

        // Create profile details
        const profileDetails = document.createElement('div');
        profileDetails.className = 'profile-details';

        const profileModel = document.createElement('div');
        profileModel.className = 'profile-model';
        const modelText = this.shouldDisplayEndpoint(profile) ?
            `${profile.model} (${formatEndpointForDisplay(profile.endpoint)})` :
            profile.model;
        profileModel.textContent = modelText;

        const profileOptions = document.createElement('div');
        profileOptions.className = 'profile-options';

        const processInfo = document.createElement('small');
        processInfo.className = 'text-muted';
        const processIcon = document.createElement('i');
        processIcon.className = `bx ${profile.processImmediately ? 'bx-check-square' : 'bx-square'}`;
        processIcon.setAttribute('title', 'Process immediately');
        processInfo.appendChild(processIcon);
        processInfo.appendChild(document.createTextNode(' Process immediately'));

        const profileActions = document.createElement('div');
        profileActions.className = 'profile-actions';

        // Clone button
        const cloneBtn = document.createElement('button');
        cloneBtn.className = 'btn clone-profile-btn';
        cloneBtn.setAttribute('data-profile-id', profile.id);
        cloneBtn.setAttribute('title', 'Clone profile');
        const cloneIcon = document.createElement('i');
        cloneIcon.className = 'bx bx-copy-plus';
        cloneBtn.appendChild(cloneIcon);

        // Edit button
        const editBtn = document.createElement('button');
        editBtn.className = 'btn edit-profile-btn';
        editBtn.setAttribute('data-profile-id', profile.id);
        editBtn.setAttribute('title', 'Edit profile');
        const editIcon = document.createElement('i');
        editIcon.className = 'bx bx-edit';
        editBtn.appendChild(editIcon);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn delete-profile-btn';
        deleteBtn.setAttribute('data-profile-id', profile.id);
        deleteBtn.setAttribute('title', 'Delete profile');
        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'bx bx-trash';
        deleteBtn.appendChild(deleteIcon);

        // Add event listeners
        cloneBtn.addEventListener('click', (e) => {
            const profileId = e.currentTarget.getAttribute('data-profile-id');
            this.cloneProfile(profileId);
        });

        editBtn.addEventListener('click', (e) => {
            const profileId = e.currentTarget.getAttribute('data-profile-id');
            this.editProfile(profileId);
        });

        deleteBtn.addEventListener('click', (e) => {
            const profileId = e.currentTarget.getAttribute('data-profile-id');
            this.deleteProfile(profileId);
        });

        profileActions.appendChild(cloneBtn);
        profileActions.appendChild(editBtn);
        profileActions.appendChild(deleteBtn);

        profileOptions.appendChild(processInfo);
        profileOptions.appendChild(profileActions);

        profileDetails.appendChild(profileModel);
        profileDetails.appendChild(profileOptions);

        profileItem.appendChild(profileHeader);
        profileItem.appendChild(profileDetails);

        return profileItem;
    }

    navigateToEditPage(profileId = null) {
        if (profileId) {
            window.location.href = `profile-edit.html?id=${profileId}`;
        } else {
            window.location.href = 'profile-edit.html';
        }
    }

    editProfile(profileId) {
        this.navigateToEditPage(profileId);
    }

    async deleteProfile(profileId) {
        if (confirm('Are you sure you want to delete this profile?')) {
            this.profiles = this.profiles.filter(p => p.id !== profileId);
            await this.saveProfiles();
            this.renderProfiles();
            this.showStatus('Profile deleted successfully.', 'success');
        }
    }

    cloneProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (profile) {
            const cloneData = {
                ...profile,
                name: `${profile.name} (clone)`,
                id: generateId()
            };
            
            const cloneDataParam = encodeURIComponent(JSON.stringify(cloneData));
            window.location.href = `profile-edit.html?clone=${cloneDataParam}`;
        }
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
                       typeof profile.model === 'string' &&
                       (typeof profile.apiKey === 'string' || profile.apiKey === null || profile.apiKey === undefined);
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
            this.renderProfiles();

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
        
        // Clear any existing timeout
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }
        
        statusMessage.className = `alert alert-${type}`;
        statusText.textContent = message;
        statusMessage.classList.remove('d-none');

        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            this.statusTimeout = setTimeout(() => {
                statusMessage.classList.add('d-none');
                this.statusTimeout = null;
            }, 5000);
        }
    }
}

// Initialize settings manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    new SettingsManager();
});