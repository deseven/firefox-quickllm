// Profile management for QuickLLM extension
import './extension.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';
import Sortable from 'sortablejs';
import { PROMPT_TEMPLATES } from '../../utils/prompt-templates.js';
import { applyTheme, loadProfiles, saveProfiles, escapeHtml, generateId } from '../../utils/utils.js';

// Make bootstrap available globally for the HTML
window.bootstrap = bootstrap;
window.Sortable = Sortable;
class ProfileManager {
    constructor() {
        this.profiles = [];
        this.sortable = null;
        this.init();
    }

    async init() {
        applyTheme();
        this.profiles = await loadProfiles();
        this.setupEventListeners();
        this.setupSortable();
        this.renderProfiles();
    }

    async saveProfiles() {
        await saveProfiles(this.profiles);
    }

    setupEventListeners() {
        // Add profile buttons
        document.getElementById('addProfileBtn').addEventListener('click', () => {
            this.navigateToEditPage();
        });
        
        document.getElementById('addFirstProfileBtn').addEventListener('click', () => {
            this.navigateToEditPage();
        });

        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.navigateToSettingsPage();
        });

        // Note: Modal-related functionality moved to process.js
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
        const loadingState = document.getElementById('loadingState');
        const addProfileSection = document.getElementById('addProfileSection');

        // Hide loading state
        loadingState.classList.add('d-none');

        if (this.profiles.length === 0) {
            profilesList.innerHTML = '';
            emptyState.classList.remove('d-none');
            addProfileSection.classList.add('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        addProfileSection.classList.remove('d-none');
        
        profilesList.innerHTML = this.profiles.map((profile, index) => `
            <div class="profile-item" data-profile-id="${profile.id}">
                <div class="profile-header">
                    <i class="bx bx-menu drag-handle"></i>
                    <h6 class="profile-name">${escapeHtml(profile.name)}</h6>
                    <span class="profile-type ${profile.type}">
                        <i class='bxl bx-${profile.type}'></i>
                    </span>
                </div>
                <div class="profile-details">
                    <div class="profile-model">
                        ${escapeHtml(profile.model)}${profile.endpoint ? ` (${escapeHtml(this.formatEndpoint(profile.endpoint))})` : ''}
                    </div>
                    <div class="profile-options">
                        <small class="text-muted">
                            <i class="bx ${profile.processImmediately ? 'bx-check-square' : 'bx-square'}" title="Process immediately"></i>
                            Process immediately
                        </small>
                        <div class="profile-actions">
                            <button class="btn clone-profile-btn" data-profile-id="${profile.id}" title="Clone profile">
                                <i class='bx bx-copy-plus'></i>
                            </button>
                            <button class="btn edit-profile-btn" data-profile-id="${profile.id}" title="Edit profile">
                                <i class="bx bx-edit"></i>
                            </button>
                            <button class="btn delete-profile-btn" data-profile-id="${profile.id}" title="Delete profile">
                                <i class="bx bx-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add event listeners for clone, edit and delete buttons
        profilesList.querySelectorAll('.clone-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileId = e.currentTarget.getAttribute('data-profile-id');
                this.cloneProfile(profileId);
            });
        });

        profilesList.querySelectorAll('.edit-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileId = e.currentTarget.getAttribute('data-profile-id');
                this.editProfile(profileId);
            });
        });

        profilesList.querySelectorAll('.delete-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profileId = e.currentTarget.getAttribute('data-profile-id');
                this.deleteProfile(profileId);
            });
        });
    }

    navigateToEditPage(profileId = null) {
        if (profileId) {
            window.location.href = `profile-edit.html?id=${profileId}`;
        } else {
            window.location.href = 'profile-edit.html';
        }
    }

    navigateToSettingsPage() {
        browser.tabs.create({ url: browser.runtime.getURL('dist/settings.html') });
    }

    editProfile(profileId) {
        this.navigateToEditPage(profileId);
    }

    async deleteProfile(profileId) {
        if (confirm('Are you sure you want to delete this profile?')) {
            this.profiles = this.profiles.filter(p => p.id !== profileId);
            await this.saveProfiles();
            this.renderProfiles();
        }
    }

    cloneProfile(profileId) {
        const profile = this.profiles.find(p => p.id === profileId);
        if (profile) {
            // Create clone data with "(clone)" added to the name
            const cloneData = {
                ...profile,
                name: `${profile.name} (clone)`,
                id: generateId() // Generate new ID for the clone
            };
            
            // Navigate to edit page with clone data
            const cloneDataParam = encodeURIComponent(JSON.stringify(cloneData));
            window.location.href = `profile-edit.html?clone=${cloneDataParam}`;
        }
    }


    // Extract just the domain from endpoint for display
    formatEndpoint(endpoint) {
        if (!endpoint) return '';
        try {
            const url = new URL(endpoint);
            return url.hostname;
        } catch (e) {
            // Fallback if URL parsing fails
            return endpoint.replace(/^https?:\/\//, '').split('/')[0];
        }
    }

    // Get first available profile
    getDefaultProfile() {
        return this.profiles[0] || null;
    }

    // Get profile by ID
    getProfile(profileId) {
        return this.profiles.find(p => p.id === profileId);
    }

    // Modal functionality has been moved to process.js and process.html
}

// Initialize profile manager when extension loads
let profileManager;
document.addEventListener('DOMContentLoaded', () => {
    profileManager = new ProfileManager();
});

// Listen for messages from content script or background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Modal functionality has been moved to process.js
    // Messages will be handled by the appropriate window/tab
});