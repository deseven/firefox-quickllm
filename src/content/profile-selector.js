// Profile selector modal for the content script.
//
// Renders the profile selection list inside a ShadowModal and handles
// keyboard navigation (arrow keys, number keys 1-0, Enter, Escape).
//
// The keyboard navigation logic is extracted into a pure function
// (resolveProfileSelectorAction) so it can be unit-tested without a DOM.

import { createElement } from '../utils/dom-utils.js';
import { prefersDarkMode } from '../utils/theme-utils.js';
import ShadowModal from '../utils/shadow-modal.js';

/**
 * @typedef {import('./types.js').Profile} Profile
 */

/**
 * Decides what the profile selector should do for a given keyboard event.
 *
 * - Number keys Digit1..Digit9 select profiles 0..8; Digit0 selects index 9.
 * - ArrowUp/ArrowDown move the selection cursor (clamped to the list bounds).
 * - Enter confirms the current selection.
 * - Escape cancels.
 *
 * The returned action is a plain object so callers can apply it without
 * coupling to the DOM.
 *
 * @param {{ key: string, code: string, shiftKey?: boolean }} event - The keydown event (or a minimal stub).
 * @param {number} currentIndex - The currently selected profile index.
 * @param {number} profileCount - Total number of profiles.
 * @returns {{ action: 'select'|'move'|'confirm'|'cancel'|null, index?: number, shiftKey: boolean }}
 */
export function resolveProfileSelectorAction(event, currentIndex, profileCount) {
    const shiftKey = !!event.shiftKey;

    // Number keys 1-0 for direct profile selection
    if ((event.code >= 'Digit1' && event.code <= 'Digit9') || event.code === 'Digit0') {
        const profileIndex = event.code === 'Digit0' ? 9 : parseInt(event.code.slice(-1), 10) - 1;
        if (profileIndex < profileCount) {
            return { action: 'select', index: profileIndex, shiftKey };
        }
        return { action: null, shiftKey };
    }

    switch (event.key) {
        case 'ArrowUp':
            return { action: 'move', index: Math.max(0, currentIndex - 1), shiftKey };
        case 'ArrowDown':
            return { action: 'move', index: Math.min(profileCount - 1, currentIndex + 1), shiftKey };
        case 'Enter':
            return { action: 'confirm', index: currentIndex, shiftKey };
        case 'Escape':
            return { action: 'cancel', shiftKey };
        default:
            return { action: null, shiftKey };
    }
}

/**
 * Build the profile selector modal content element.
 *
 * @param {Profile[]} profiles - The profiles to list.
 * @param {boolean} prefersDark - Whether dark theme is active.
 * @returns {HTMLElement} The modal content root element.
 */
export function buildProfileSelectorContent(profiles, prefersDark) {
    const modalContent = createElement('div', {
        className: 'quickllm-modal-content quickllm-profile-selector'
    });

    // Header
    const header = createElement('div', { className: 'quickllm-modal-header' });
    const title = createElement('h3', {
        className: 'quickllm-modal-title',
        textContent: 'Select Profile'
    });
    const closeBtn = createElement('button', {
        className: 'quickllm-close-btn',
        textContent: '×'
    });
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Profile list
    const profileList = createElement('div', {
        className: 'quickllm-profile-list',
        id: 'quickllm-profile-list'
    });

    profiles.forEach((profile, index) => {
        const profileItem = createElement('div', {
            className: `quickllm-profile-item ${index === 0 ? 'selected' : ''}`,
            attributes: {
                'data-profile-id': profile.id,
                'data-index': index.toString()
            }
        });

        const profileHeader = createElement('div', {
            className: 'quickllm-profile-item-header'
        });

        if (index < 10) {
            const numberSpan = createElement('span', {
                textContent: index === 9 ? '0' : (index + 1).toString(),
                className: 'quickllm-profile-number'
            });
            profileHeader.appendChild(numberSpan);
        }

        const profileName = createElement('div', {
            textContent: profile.name,
            className: 'quickllm-profile-name'
        });
        profileHeader.appendChild(profileName);

        const profileDetails = createElement('div', {
            textContent: `${profile.type} - ${profile.model}`,
            className: `quickllm-profile-details ${index < 10 ? 'with-number' : ''}`
        });

        profileItem.appendChild(profileHeader);
        profileItem.appendChild(profileDetails);
        profileList.appendChild(profileItem);
    });

    // Instructions
    const instructions = createElement('div', {
        className: 'quickllm-profile-instructions'
    });

    const instructionLines = [
        '• Use arrow keys or number keys (1-0) to select a profile',
        '• Enter to select',
        '• Escape to cancel',
        '• Hold Shift while selecting to bypass "Process immediately"'
    ];

    instructionLines.forEach((line, idx) => {
        if (idx > 0) instructions.appendChild(document.createElement('br'));
        instructions.appendChild(document.createTextNode(line));
    });

    modalContent.appendChild(header);
    modalContent.appendChild(profileList);
    modalContent.appendChild(instructions);

    return modalContent;
}

/**
 * Show the profile selector modal.
 *
 * @param {Profile[]} profiles - The profiles to choose from.
 * @param {string} text - The extracted text to process.
 * @param {string} textType - How the text was obtained (for the title).
 * @param {(profile: Profile, bypassProcessImmediately: boolean) => void} onSelect - Called when a profile is chosen.
 * @param {() => void} onCancel - Called when the user cancels.
 * @returns {Promise<ShadowModal>} The created modal (for external query access).
 */
export async function showProfileSelector(profiles, text, textType, onSelect, onCancel) {
    const prefersDark = await prefersDarkMode();

    const modal = new ShadowModal();
    await modal.create(() => buildProfileSelectorContent(profiles, prefersDark), {
        darkTheme: prefersDark,
        onClose: () => onCancel()
    });

    let selectedIndex = 0;
    const profileItems = modal.querySelectorAll('.quickllm-profile-item');

    const updateSelection = () => {
        profileItems.forEach((item, index) => {
            const el = /** @type {HTMLElement} */ (item);
            if (index === selectedIndex) {
                el.classList.add('selected');
                el.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
            } else {
                el.classList.remove('selected');
            }
        });
    };

    let selectionMade = false;
    const selectProfile = (bypassProcessImmediately = false) => {
        // Guard against duplicate selection: Enter can fire multiple times
        // before the modal is destroyed, which would open the prompt modal
        // repeatedly.
        if (selectionMade) return;
        selectionMade = true;

        const selectedProfile = profiles[selectedIndex];
        modal.destroy();
        onSelect(selectedProfile, bypassProcessImmediately);
    };

    // Click handlers
    profileItems.forEach((item, index) => {
        const el = /** @type {HTMLElement} */ (item);
        el.addEventListener('click', (e) => {
            selectedIndex = index;
            selectProfile(e.shiftKey);
        });
    });

    // Keyboard navigation — registered via the modal's keyboard isolation
    // layer so that only our hotkeys work while the modal is active and the
    // host page's keyboard handlers are completely blocked.
    const handleKeyDown = (/** @type {KeyboardEvent} */ e) => {
        const result = resolveProfileSelectorAction(e, selectedIndex, profiles.length);
        if (result.action === null) return;

        e.preventDefault();

        if (result.action === 'select' || result.action === 'confirm') {
            selectedIndex = result.index ?? 0;
            if (result.action === 'select') {
                updateSelection();
            }
            selectProfile(result.shiftKey);
        } else if (result.action === 'move') {
            selectedIndex = result.index ?? 0;
            updateSelection();
        } else if (result.action === 'cancel') {
            if (selectionMade) return;
            selectionMade = true;
            modal.destroy();
            onCancel();
        }
    };

    modal.setKeyHandler(handleKeyDown);

    // Initialize selection
    updateSelection();

    return modal;
}
