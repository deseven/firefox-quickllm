// Profile management for QuickLLM extension
import './extension.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';
import { applyTheme } from '../../utils/theme-utils.js';
import { loadProfiles } from '../../utils/storage-utils.js';
import { clearElement } from '../../utils/dom-utils.js';
import { getProfileIcon, getProfileModelText } from '../../utils/profile-ui-utils.js';
import { createProcessContentMessage } from '../../core/messages.js';

/**
 * @typedef {import('../../content/types.js').Profile} Profile
 */

// Make bootstrap available globally for the HTML
window.bootstrap = bootstrap;
class ProfileManager {
    constructor() {
        /** @type {Profile[]} */
        this.profiles = [];
        this.init();
    }

    async init() {
        applyTheme();
        this.profiles = await loadProfiles();
        this.setupEventListeners();
        this.renderProfiles();
    }

    setupEventListeners() {
        // Add profile button - go directly to profile creation
        document.getElementById('addFirstProfileBtn')?.addEventListener('click', () => {
            this.navigateToProfileEditPage();
        });

        // Settings button
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.navigateToSettingsPage();
        });

        // Help button
        document.getElementById('helpBtn')?.addEventListener('click', () => {
            this.navigateToHelpPage();
        });
    }

    renderProfiles() {
        const profilesList = document.getElementById('profilesList');
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('loadingState');

        if (!profilesList || !emptyState || !loadingState) return;

        // Hide loading state
        loadingState.classList.add('d-none');

        if (this.profiles.length === 0) {
            clearElement(profilesList);
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        clearElement(profilesList);
        
        // Create clickable profile items
        this.profiles.forEach((profile) => {
            const profileItem = this.createProfileElement(profile);
            profilesList.appendChild(profileItem);
        });
    }

    /**
     * @param {Profile} profile
     */
    createProfileElement(profile) {
        // Create main profile item container - clickable
        const profileItem = document.createElement('div');
        profileItem.className = 'profile-item profile-item-clickable';
        profileItem.setAttribute('data-profile-id', profile.id);
        profileItem.style.cursor = 'pointer';

        // Create profile header
        const profileHeader = document.createElement('div');
        profileHeader.className = 'profile-header';

        const profileName = document.createElement('h6');
        profileName.className = 'profile-name';
        profileName.textContent = profile.name;

        const profileType = document.createElement('span');
        profileType.className = `profile-type ${profile.type}`;
        const typeIcon = document.createElement('i');
        typeIcon.className = getProfileIcon(profile);
        profileType.appendChild(typeIcon);

        profileHeader.appendChild(profileName);
        profileHeader.appendChild(profileType);

        // Create profile details
        const profileDetails = document.createElement('div');
        profileDetails.className = 'profile-details';

        const profileModel = document.createElement('div');
        profileModel.className = 'profile-model';
        const modelText = getProfileModelText(profile);
        profileModel.textContent = modelText;

        profileDetails.appendChild(profileModel);

        profileItem.appendChild(profileHeader);
        profileItem.appendChild(profileDetails);

        // Add click event to trigger processing
        profileItem.addEventListener('click', () => {
            this.triggerProcessing(profile);
        });

        return profileItem;
    }

    /**
     * @param {Profile} profile
     */
    async triggerProcessing(profile) {
        // Send message to active tab to trigger processing with this profile
        try {
            const tabs = await browser.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]) {
                await browser.tabs.sendMessage(tabs[0].id, createProcessContentMessage(profile.id));
                // Close the popup after triggering
                window.close();
            }
        } catch (error) {
            console.error('Error triggering processing:', error);
            // If we can't send to tab, show an error
            alert('Please navigate to a web page to use QuickLLM');
        }
    }

    navigateToProfileEditPage() {
        browser.tabs.create({ url: browser.runtime.getURL('dist/profile-edit.html') });
        window.close();
    }

    navigateToSettingsPage() {
        browser.tabs.create({ url: browser.runtime.getURL('dist/settings.html') });
        window.close();
    }

    navigateToHelpPage() {
        browser.tabs.create({ url: browser.runtime.getURL('dist/help.html') });
        window.close();
    }
}

// Initialize profile manager when extension loads
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});
