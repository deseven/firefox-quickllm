// Profile management for QuickLLM extension
import './extension.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import * as bootstrap from 'bootstrap';
import Sortable from 'sortablejs';
import { PROMPT_TEMPLATES } from '../../utils/prompt-templates.js';
import { applyTheme, loadProfiles, saveProfiles, escapeHtml, generateId, clearElement, formatEndpointForDisplay } from '../../utils/utils.js';

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
            // Clear existing content using utility function
            clearElement(profilesList);
            emptyState.classList.remove('d-none');
            addProfileSection.classList.add('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        addProfileSection.classList.remove('d-none');
        
        // Clear existing content using utility function
        clearElement(profilesList);
        
        // Create profile items using DOM APIs
        this.profiles.forEach((profile, index) => {
            const profileItem = this.createProfileElement(profile);
            profilesList.appendChild(profileItem);
        });

        // Event listeners are now added in createProfileElement method
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
        typeIcon.className = `bxl bx-${profile.type}`;
        profileType.appendChild(typeIcon);

        profileHeader.appendChild(dragHandle);
        profileHeader.appendChild(profileName);
        profileHeader.appendChild(profileType);

        // Create profile details
        const profileDetails = document.createElement('div');
        profileDetails.className = 'profile-details';

        const profileModel = document.createElement('div');
        profileModel.className = 'profile-model';
        const modelText = profile.endpoint ?
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