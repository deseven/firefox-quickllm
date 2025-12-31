// Profile editing page functionality
import './profile-edit.css';
import { PROMPT_TEMPLATES } from '../../utils/prompt-templates.js';
import { applyTheme, escapeHtml, generateId } from '../../utils/utils.js';

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
        await this.loadProfileFromUrl();
    }

    setupEventListeners() {
        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.goBack();
        });

        // Form submission
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // Prompt template button
        document.getElementById('promptTemplateBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.togglePromptTemplateDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('promptTemplateDropdown');
            const button = document.getElementById('promptTemplateBtn');
            if (!dropdown.contains(e.target) && !button.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        // Mode switch toggle
        document.getElementById('advancedModeToggle').addEventListener('change', (e) => {
            this.toggleMode(e.target.checked);
        });
    }


    setupPromptTemplateDropdown() {
        const dropdown = document.getElementById('promptTemplateDropdown');
        
        // Populate dropdown with templates
        dropdown.innerHTML = PROMPT_TEMPLATES.map(template => `
            <div class="template-item" data-template-name="${template.name}">
                ${escapeHtml(template.name)}
            </div>
        `).join('');

        // Add click listeners to template items
        dropdown.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const templateName = e.currentTarget.getAttribute('data-template-name');
                this.selectPromptTemplate(templateName);
            });
        });
    }

    togglePromptTemplateDropdown() {
        const dropdown = document.getElementById('promptTemplateDropdown');
        const button = document.getElementById('promptTemplateBtn');
        
        // Don't show dropdown if button is disabled
        if (button.disabled) {
            return;
        }
        
        dropdown.classList.toggle('show');
    }

    selectPromptTemplate(templateName) {
        const template = PROMPT_TEMPLATES.find(t => t.name === templateName);
        if (template) {
            const systemPromptTextarea = document.getElementById('systemPrompt');
            systemPromptTextarea.value = template.prompt;
            
            // Close dropdown
            document.getElementById('promptTemplateDropdown').classList.remove('show');
        }
    }

    setupModeSwitch() {
        // Initialize in basic mode
        this.setMode(false);
    }

    toggleMode(isAdvanced) {
        this.isAdvancedMode = isAdvanced;
        this.setMode(isAdvanced);
    }

    setMode(isAdvanced) {
        const form = document.getElementById('profileForm');
        const toggle = document.getElementById('advancedModeToggle');
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
        const customEndpoint = document.getElementById('apiEndpoint').value.trim();
        const userPrompt = document.getElementById('userPrompt').value.trim();
        const extraOptions = document.getElementById('extraOptions').value.trim();
        
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

    async loadProfile(profileId) {
        this.showLoading(true);
        
        try {
            const result = await browser.storage.local.get('profiles');
            const profiles = result.profiles || [];
            const profile = profiles.find(p => p.id === profileId);
            
            if (profile) {
                // Populate form
                document.getElementById('profileId').value = profile.id;
                document.getElementById('profileName').value = profile.name;
                document.getElementById('profileType').value = profile.type;
                document.getElementById('apiEndpoint').value = profile.endpoint || '';
                document.getElementById('apiKey').value = profile.apiKey;
                document.getElementById('modelName').value = profile.model;
                document.getElementById('extraOptions').value = profile.extraOptions || '';
                document.getElementById('systemPrompt').value = profile.systemPrompt || '';
                document.getElementById('userPrompt').value = profile.userPrompt || '';
                document.getElementById('processImmediately').checked = profile.processImmediately || false;
                
                // Automatically switch to advanced mode if any advanced fields have values
                const shouldBeAdvanced = this.detectAdvancedMode();
                this.setMode(shouldBeAdvanced);
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

    loadCloneData(profile) {
        // Populate form with clone data (similar to loadProfile but without loading from storage)
        document.getElementById('profileId').value = ''; // Clear ID for new profile
        document.getElementById('profileName').value = profile.name;
        document.getElementById('profileType').value = profile.type;
        document.getElementById('apiEndpoint').value = profile.endpoint || '';
        document.getElementById('apiKey').value = profile.apiKey;
        document.getElementById('modelName').value = profile.model;
        document.getElementById('extraOptions').value = profile.extraOptions || '';
        document.getElementById('systemPrompt').value = profile.systemPrompt || '';
        document.getElementById('userPrompt').value = profile.userPrompt || '';
        document.getElementById('processImmediately').checked = profile.processImmediately || false;
        
        // Automatically switch to advanced mode if any advanced fields have values
        const shouldBeAdvanced = this.detectAdvancedMode();
        this.setMode(shouldBeAdvanced);
        
        // This is a new profile (clone), so clear the profileId
        this.profileId = null;
    }

    async saveProfile() {
        const form = document.getElementById('profileForm');
        const formData = new FormData(form);
        
        const extraOptionsText = (formData.get('extraOptions') || '').trim();
        
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
        
        const profileData = {
            name: formData.get('profileName').trim(),
            type: formData.get('profileType'),
            endpoint: formData.get('apiEndpoint').trim() || null,
            apiKey: formData.get('apiKey').trim(),
            model: formData.get('modelName').trim(),
            extraOptions: extraOptionsText || null,
            systemPrompt: (formData.get('systemPrompt') || '').trim(),
            userPrompt: (formData.get('userPrompt') || '').trim() || null,
            processImmediately: document.getElementById('processImmediately').checked
        };

        // Validation
        if (!profileData.name || !profileData.type || !profileData.apiKey || !profileData.model || !profileData.systemPrompt) {
            this.showError('Please fill in all required fields.');
            return;
        }

        this.showLoading(true);

        try {
            const result = await browser.storage.local.get('profiles');
            let profiles = result.profiles || [];
            
            if (this.profileId) {
                // Edit existing profile
                const index = profiles.findIndex(p => p.id === this.profileId);
                if (index !== -1) {
                    profiles[index] = { ...profiles[index], ...profileData };
                }
            } else {
                // Add new profile
                profileData.id = generateId();
                profiles.push(profileData);
            }

            await browser.storage.local.set({ profiles: profiles });
            
            // Notify background script to update context menus
            browser.runtime.sendMessage({ type: 'profilesUpdated' });
            
            // Go back to main page
            this.goBack();
            
        } catch (error) {
            console.error('Error saving profile:', error);
            this.showError('Error saving profile');
        } finally {
            this.showLoading(false);
        }
    }

    goBack() {
        // Navigate back to extension
        window.location.href = 'extension.html';
    }

    showLoading(show) {
        const loadingState = document.getElementById('loadingState');
        if (show) {
            loadingState.classList.remove('d-none');
        } else {
            loadingState.classList.add('d-none');
        }
    }

    showError(message) {
        // Simple alert for now - could be enhanced with a toast notification
        alert(message);
    }

}

// Initialize profile editor when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ProfileEditor();
});