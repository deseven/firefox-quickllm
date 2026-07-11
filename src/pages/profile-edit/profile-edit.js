// Profile editing page functionality
import './profile-edit.css';
import { PROMPT_TEMPLATES } from '../../utils/prompt-templates.js';
import { applyTheme } from '../../utils/theme-utils.js';
import { escapeHtml, clearElement } from '../../utils/dom-utils.js';
import { loadProfiles, saveProfiles, generateProfileId } from '../../utils/storage-utils.js';
import { PROVIDER_METADATA, getProviderTypeList } from '../../core/providers/provider-types.js';

/**
 * @typedef {import('../../content/types.js').Profile} Profile
 */

/**
 * Get a form element by ID, cast to HTMLInputElement.
 * @param {string} id
 * @returns {HTMLInputElement}
 */
function getInput(id) {
    return /** @type {HTMLInputElement} */ (document.getElementById(id));
}

/**
 * Get a textarea element by ID, cast to HTMLTextAreaElement.
 * @param {string} id
 * @returns {HTMLTextAreaElement}
 */
function getTextArea(id) {
    return /** @type {HTMLTextAreaElement} */ (document.getElementById(id));
}

/**
 * Get a select element by ID, cast to HTMLSelectElement.
 * @param {string} id
 * @returns {HTMLSelectElement}
 */
function getSelect(id) {
    return /** @type {HTMLSelectElement} */ (document.getElementById(id));
}

/**
 * Get a form element by ID, cast to HTMLFormElement.
 * @param {string} id
 * @returns {HTMLFormElement}
 */
function getForm(id) {
    return /** @type {HTMLFormElement} */ (document.getElementById(id));
}

/**
 * Get a button element by ID, cast to HTMLButtonElement.
 * @param {string} id
 * @returns {HTMLButtonElement}
 */
function getButton(id) {
    return /** @type {HTMLButtonElement} */ (document.getElementById(id));
}

class ProfileEditor {
    constructor() {
        this.profileId = null;
        this.isAdvancedMode = false;
        this.init();
    }

    async init() {
        applyTheme();
        this.setupEventListeners();
        this.setupPromptTemplateDropdown();
        this.setupModeSwitch();
        this.populateProviderTypes();
        await this.loadProfileFromUrl();
    }

    /**
     * Populate the profile type dropdown from the central provider registry.
     * This keeps the dropdown in sync with the supported providers without
     * duplicating the list in HTML.
     */
    populateProviderTypes() {
        const select = getSelect('profileType');
        // Preserve the placeholder option
        const placeholder = select.querySelector('option[value=""]');
        clearElement(select);
        if (placeholder) {
            select.appendChild(placeholder);
        }
        for (const type of getProviderTypeList()) {
            const meta = /** @type {any} */ (PROVIDER_METADATA)[type];
            const option = document.createElement('option');
            option.value = type;
            option.textContent = meta ? meta.label : type;
            select.appendChild(option);
        }
    }

    setupEventListeners() {
        // Cancel button
        getButton('cancelBtn').addEventListener('click', () => {
            this.goBack();
        });

        // Form submission
        getForm('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // Prompt template button
        getButton('promptTemplateBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.togglePromptTemplateDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('promptTemplateDropdown');
            const button = document.getElementById('promptTemplateBtn');
            if (dropdown && button && !dropdown.contains(/** @type {Node} */ (e.target)) && !button.contains(/** @type {Node} */ (e.target))) {
                dropdown.classList.remove('show');
            }
        });

        // Mode switch toggle
        getInput('advancedModeToggle').addEventListener('change', (e) => {
            this.toggleMode(/** @type {HTMLInputElement} */ (e.target).checked);
        });
    }


    setupPromptTemplateDropdown() {
        const dropdown = document.getElementById('promptTemplateDropdown');
        if (!dropdown) return;

        // Clear existing content using utility function
        clearElement(dropdown);
        
        // Create template items using DOM APIs
        PROMPT_TEMPLATES.forEach(template => {
            const templateItem = document.createElement('div');
            templateItem.className = 'template-item';
            templateItem.setAttribute('data-template-name', template.name);
            templateItem.textContent = template.name;
            
            // Add click listener
            templateItem.addEventListener('click', (e) => {
                const target = /** @type {HTMLElement} */ (e.currentTarget);
                const templateName = target.getAttribute('data-template-name') || '';
                this.selectPromptTemplate(templateName);
            });
            
            dropdown.appendChild(templateItem);
        });
    }

    togglePromptTemplateDropdown() {
        const dropdown = document.getElementById('promptTemplateDropdown');
        const button = getButton('promptTemplateBtn');

        if (!dropdown) return;
        // Don't show dropdown if button is disabled
        if (button.disabled) {
            return;
        }

        dropdown.classList.toggle('show');
    }

    /**
     * @param {string} templateName
     */
    selectPromptTemplate(templateName) {
        const template = PROMPT_TEMPLATES.find(t => t.name === templateName);
        if (template) {
            const systemPromptTextarea = getTextArea('systemPrompt');
            systemPromptTextarea.value = template.prompt;

            // Close dropdown
            const dropdown = document.getElementById('promptTemplateDropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
        }
    }

    setupModeSwitch() {
        // Initialize in basic mode
        this.setMode(false);
    }

    /**
     * @param {boolean} isAdvanced
     */
    toggleMode(isAdvanced) {
        this.isAdvancedMode = isAdvanced;
        this.setMode(isAdvanced);
    }

    /**
     * @param {boolean} isAdvanced
     */
    setMode(isAdvanced) {
        const form = getForm('profileForm');
        const toggle = getInput('advancedModeToggle');
        const labels = document.querySelectorAll('.mode-label');
        
        if (isAdvanced) {
            form.classList.remove('basic-mode');
            toggle.checked = true;
            labels[0].classList.remove('active'); // Basic
            labels[1].classList.add('active');    // Advanced
        } else {
            form.classList.add('basic-mode');
            toggle.checked = false;
            labels[0].classList.add('active');    // Basic
            labels[1].classList.remove('active'); // Advanced
        }
        
        this.isAdvancedMode = isAdvanced;
    }

    detectAdvancedMode() {
        // Check if any advanced fields have values
        const customEndpoint = getInput('apiEndpoint').value.trim();
        const userPrompt = getInput('userPrompt').value.trim();
        const extraOptions = getTextArea('extraOptions').value.trim();
        
        return customEndpoint || userPrompt || extraOptions;
    }

    async loadProfileFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const profileId = urlParams.get('id');
        const cloneData = urlParams.get('clone');
        
        if (cloneData) {
            // Handle clone data
            try {
                const profile = JSON.parse(decodeURIComponent(cloneData));
                this.loadCloneData(profile);
            } catch (error) {
                console.error('Error parsing clone data:', error);
                this.showError('Error loading clone data');
            }
        } else if (profileId) {
            this.profileId = profileId;
            await this.loadProfile(profileId);
        }
    }

    /**
     * Load a profile from storage and populate the form.
     * @param {string} profileId
     */
    async loadProfile(profileId) {
        this.showLoading(true);
        
        try {
            // loadProfiles deobfuscates API keys so the form shows the
            // plaintext key the user originally entered.
            const profiles = await loadProfiles();
            const profile = profiles.find(p => p.id === profileId);
            
            if (profile) {
                this.populateForm(profile);
            } else {
                this.showError('Profile not found');
                setTimeout(() => this.goBack(), 2000);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            this.showError('Error loading profile');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Populate the form fields from a profile object.
     * @param {Profile} profile
     */
    populateForm(profile) {
        getInput('profileId').value = profile.id;
        getInput('profileName').value = profile.name;
        getSelect('profileType').value = profile.type;
        getInput('apiEndpoint').value = profile.endpoint || '';
        getInput('apiKey').value = profile.apiKey || '';
        getInput('modelName').value = profile.model;
        getTextArea('extraOptions').value = profile.extraOptions || '';
        getTextArea('systemPrompt').value = profile.systemPrompt || '';
        getTextArea('userPrompt').value = profile.userPrompt || '';
        getInput('processImmediately').checked = profile.processImmediately || false;
        getInput('diffOutput').checked = profile.diffOutput || false;
        
        // Automatically switch to advanced mode if any advanced fields have values
        const shouldBeAdvanced = !!this.detectAdvancedMode();
        this.setMode(shouldBeAdvanced);
    }

    /**
     * Populate the form with clone data (without loading from storage).
     * @param {Profile} profile
     */
    loadCloneData(profile) {
        // Clear ID for new profile
        getInput('profileId').value = '';
        this.populateForm(profile);
        
        // This is a new profile (clone), so clear the profileId
        this.profileId = null;
    }

    async saveProfile() {
        const form = getForm('profileForm');
        const formData = new FormData(form);
        
        const extraOptionsText = (/** @type {string} */ (formData.get('extraOptions')) || '').trim();
        
        // Validate JSON if extra options are provided
        let extraOptions = null;
        if (extraOptionsText) {
            try {
                extraOptions = JSON.parse(extraOptionsText);
            } catch (error) {
                this.showError('Extra options must be valid JSON format.');
                return;
            }
        }
        
        /** @type {Profile} */
        const profileData = {
            id: this.profileId || generateProfileId(),
            name: /** @type {string} */ (formData.get('profileName')).trim(),
            type: /** @type {string} */ (formData.get('profileType')),
            endpoint: /** @type {string} */ (formData.get('apiEndpoint')).trim() || null,
            apiKey: /** @type {string} */ (formData.get('apiKey')).trim() || null,
            model: /** @type {string} */ (formData.get('modelName')).trim(),
            extraOptions: extraOptionsText || null,
            systemPrompt: (/** @type {string} */ (formData.get('systemPrompt')) || '').trim(),
            userPrompt: (/** @type {string} */ (formData.get('userPrompt')) || '').trim() || null,
            processImmediately: getInput('processImmediately').checked,
            diffOutput: getInput('diffOutput').checked
        };

        // Validation
        if (!profileData.name || !profileData.type || !profileData.model || !profileData.systemPrompt) {
            this.showError('Please fill in all required fields.');
            return;
        }

        this.showLoading(true);

        try {
            // loadProfiles returns plaintext keys; saveProfiles obfuscates
            // them before they reach storage, so the raw key never persists.
            let profiles = await loadProfiles();
            
            let isEdit = false;
            if (this.profileId) {
                // Edit existing profile
                const index = profiles.findIndex(p => p.id === this.profileId);
                if (index !== -1) {
                    profiles[index] = { ...profiles[index], ...profileData };
                    isEdit = true;
                }
            } else {
                // Add new profile
                profiles.push(profileData);
            }

            // saveProfiles obfuscates API keys and notifies the background
            // script to refresh context menus.
            await saveProfiles(profiles);
            
            // Go back to main page with appropriate notification
            this.goBack(isEdit);
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showError('Error saving profile');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * @param {boolean|null} [isEdit]
     */
    goBack(isEdit = null) {
        // Navigate back to settings page with Profiles tab active
        // Pass notification type if profile was saved
        if (isEdit === true) {
            window.location.href = 'settings.html#profile-edited';
        } else if (isEdit === false) {
            window.location.href = 'settings.html#profile-created';
        } else {
            // Cancelled - just go to profiles tab
            window.location.href = 'settings.html#profiles';
        }
    }

    /**
     * @param {boolean} show
     */
    showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            if (show) {
                loadingState.classList.remove('d-none');
            } else {
                loadingState.classList.add('d-none');
            }
        }
    }

    /**
     * @param {string} message
     */
    showError(message) {
        // Simple alert for now - could be enhanced with a toast notification
        alert(message);
    }

}

// Initialize profile editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ProfileEditor();
});
