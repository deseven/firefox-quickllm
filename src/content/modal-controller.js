// Modal controller for the content script.
//
// Coordinates the lifecycle of the content script modals: it owns the
// currently active ShadowModal, manages stream state (stream ID, diff
// context, throttling), and delegates to the focused sub-modules:
//   - text-extractor for page/selection extraction
//   - profile-selector for the profile picker
//   - prompt-modal for the main processing UI
//
// This replaces the monolithic ContentManager, keeping the coordination
// logic in one place while the UI construction and keyboard logic live
// in their own testable modules.

import { createElement, clearElement, renderMarkdownToElement, createLoadingElement, showErrorState } from '../utils/dom-utils.js';
import { prefersDarkMode } from '../utils/theme-utils.js';
import diffRenderer from '../utils/diff-renderer.js';
import ShadowModal from '../utils/shadow-modal.js';
import {
    MESSAGE_TYPES,
    createGetProfilesMessage,
    createProcessWithLLMMessage,
    createCancelStreamMessage,
    validateMessage
} from '../core/messages.js';
import { extractText, DIFF_THROTTLE_THRESHOLD } from './text-extractor.js';
import { showProfileSelector } from './profile-selector.js';
import { showPromptModal } from './prompt-modal.js';

/**
 * @typedef {import('./types.js').Profile} Profile
 * @typedef {import('./types.js').StreamState} StreamState
 */

export class ModalController {
    constructor() {
        /** @type {ShadowModal|null} */
        this.currentModal = null;
        /** @type {string|null} */
        this.currentStreamId = null;
        /** @type {boolean} */
        this.currentDiffMode = false;
        /** @type {string|null} */
        this.currentDiffOriginalText = null;
        /** @type {{ content: string }|null} */
        this._diffStreamThrottle = null;
        this.init();
    }

    init() {
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            // Validate the message shape before dispatching.
            const { valid, error } = validateMessage(message);
            if (!valid) {
                console.warn('Rejecting invalid message:', error);
                return false;
            }

            switch (message.type) {
                case MESSAGE_TYPES.PROCESS_CONTENT:
                    this.handleProcessContent(message.profileId);
                    return false; // Synchronous, no response payload

                case MESSAGE_TYPES.STREAM_UPDATE:
                    this.updateStreamingResponse(message.content, message.streamId);
                    return false; // Synchronous, no response payload

                default:
                    console.log('Unknown message type:', message.type);
                    return false;
            }
        });
    }

    /**
     * Handle a processContent message: extract text and show the prompt modal.
     * @param {string|null} profileId - Optional profile ID to use directly.
     */
    async handleProcessContent(profileId = null) {
        const { text, textType } = extractText();

        if (!text.trim()) {
            await this.showError('No text found on this page');
            return;
        }

        // Get profiles
        const profilesResponse = await browser.runtime.sendMessage(createGetProfilesMessage());
        const profiles = profilesResponse.profiles || [];

        if (profiles.length === 0) {
            await this.showError('No profiles configured. Please add a profile first.');
            return;
        }

        // If profileId is provided, find that specific profile
        if (profileId) {
            const selectedProfile = profiles.find(p => p.id === profileId);
            if (!selectedProfile) {
                await this.showError('Selected profile not found.');
                return;
            }
            await this.openPromptModal(text, textType, selectedProfile, false);
            return;
        }

        // If only one profile exists, skip the selector
        if (profiles.length === 1) {
            await this.openPromptModal(text, textType, profiles[0], false);
            return;
        }

        // Show the profile selector
        await this.openProfileSelector(profiles, text, textType);
    }

    /**
     * Open the profile selector modal.
     * @param {Profile[]} profiles
     * @param {string} text
     * @param {string} textType
     */
    async openProfileSelector(profiles, text, textType) {
        this.currentModal = await showProfileSelector(
            profiles,
            text,
            textType,
            (selectedProfile, bypassProcessImmediately) => {
                this.currentModal = null;
                this.openPromptModal(text, textType, selectedProfile, bypassProcessImmediately);
            },
            () => this.closeModal()
        );
    }

    /**
     * Open the prompt modal for a given profile.
     * @param {string} text
     * @param {string} textType
     * @param {Profile} profile
     * @param {boolean} bypassProcessImmediately
     */
    async openPromptModal(text, textType, profile, bypassProcessImmediately) {
        const effectiveProfile = bypassProcessImmediately
            ? { ...profile, processImmediately: false }
            : profile;

        const result = await showPromptModal({
            text,
            textType,
            profile: effectiveProfile,
            onClose: () => this.closeModal(),
            onProcess: (userPrompt) => this.processWithProfile(text, effectiveProfile, userPrompt),
            onCopy: (copyBtn) => {
                const responseElement = this.currentModal?.querySelector('#quickllm-response');
                const responseText = responseElement?.textContent || '';
                navigator.clipboard.writeText(responseText);
                this.closeModal();
            }
        });

        this.currentModal = result.modal;
    }

    /**
     * Send a processWithLLM request and render the response.
     * @param {string} text
     * @param {Profile} profile
     * @param {string} userPrompt
     */
    async processWithProfile(text, profile, userPrompt) {
        if (!this.currentModal) return;

        const responseElement = /** @type {HTMLElement} */ (this.currentModal.querySelector('#quickllm-response'));
        const processBtn = /** @type {HTMLButtonElement} */ (this.currentModal.querySelector('#quickllm-process'));
        const userPromptInput = /** @type {HTMLTextAreaElement} */ (this.currentModal.querySelector('#quickllm-user-prompt'));
        const useDiff = !!profile.diffOutput;

        // Generate unique stream ID for this request
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.currentStreamId = streamId;
        this.currentDiffMode = useDiff;
        this.currentDiffOriginalText = useDiff ? text : null;
        this._diffStreamThrottle = null;

        // Show loading state
        clearElement(responseElement);
        const loadingElement = createLoadingElement('Processing...');
        responseElement.appendChild(loadingElement);
        processBtn.disabled = true;
        userPromptInput.disabled = true;

        try {
            const response = await browser.runtime.sendMessage(
                createProcessWithLLMMessage(profile, userPrompt, text, true, streamId)
            );

            if (response.success) {
                if (this.currentStreamId === streamId) {
                    if (useDiff) {
                        diffRenderer.renderToElement(text, response.response, responseElement);
                    } else {
                        renderMarkdownToElement(response.response, responseElement);
                    }

                    const copyBtn = /** @type {HTMLButtonElement} */ (this.currentModal.querySelector('#quickllm-copy'));
                    if (copyBtn) {
                        copyBtn.style.display = 'inline-block';
                    }
                }
            } else {
                if (this.currentStreamId === streamId) {
                    throw new Error(response.error);
                }
            }
        } catch (error) {
            if (this.currentStreamId === streamId) {
                showErrorState(responseElement, `Error: ${error.message}`);
            }
        } finally {
            if (this.currentStreamId === streamId) {
                processBtn.disabled = false;
                userPromptInput.disabled = false;
                setTimeout(() => {
                    userPromptInput.focus();
                    userPromptInput.select();
                }, 50);
            }
        }
    }

    /**
     * Render a streaming update into the response area.
     * @param {string} content
     * @param {string} streamId
     */
    updateStreamingResponse(content, streamId) {
        if (!this.currentModal || this.currentStreamId !== streamId) return;

        const responseElement = /** @type {HTMLElement} */ (this.currentModal.querySelector('#quickllm-response'));
        if (!responseElement) return;

        if (this.currentDiffMode) {
            // For large input texts, throttle diff updates for performance.
            const shouldThrottle = this.currentDiffOriginalText &&
                this.currentDiffOriginalText.length >= DIFF_THROTTLE_THRESHOLD;
            if (shouldThrottle) {
                if (this._diffStreamThrottle) {
                    this._diffStreamThrottle.content = content;
                } else {
                    this._diffStreamThrottle = { content };
                    requestAnimationFrame(() => {
                        if (this._diffStreamThrottle) {
                            diffRenderer.renderToElement(
                                this.currentDiffOriginalText,
                                this._diffStreamThrottle.content,
                                responseElement
                            );
                            this._diffStreamThrottle = null;
                        }
                    });
                }
            } else {
                diffRenderer.renderToElement(this.currentDiffOriginalText, content, responseElement);
            }
        } else {
            renderMarkdownToElement(content, responseElement);
        }
    }

    /**
     * Show an error modal.
     * @param {string} message
     */
    async showError(message) {
        const prefersDark = await prefersDarkMode();

        const modal = new ShadowModal();
        this.currentModal = modal;
        await modal.create(() => {
            const modalContent = createElement('div', { className: 'quickllm-modal-content' });

            const header = createElement('div', { className: 'quickllm-modal-header' });
            const title = createElement('h3', {
                className: 'quickllm-modal-title',
                textContent: 'Error'
            });
            const closeBtn = createElement('button', {
                className: 'quickllm-close-btn',
                textContent: '×'
            });
            header.appendChild(title);
            header.appendChild(closeBtn);

            const errorDiv = createElement('div', {
                className: 'quickllm-error-message',
                textContent: message
            });

            const buttonContainer = createElement('div', { className: 'quickllm-button-container' });
            const closeErrorBtn = createElement('button', {
                className: 'quickllm-btn quickllm-btn-secondary',
                id: 'quickllm-close-error',
                textContent: 'Close'
            });
            buttonContainer.appendChild(closeErrorBtn);

            modalContent.appendChild(header);
            modalContent.appendChild(errorDiv);
            modalContent.appendChild(buttonContainer);

            return modalContent;
        }, {
            darkTheme: prefersDark,
            onClose: () => this.closeModal()
        });

        modal.addEventListener('#quickllm-close-error', 'click', () => this.closeModal());

        // Auto close after 5 seconds
        setTimeout(() => this.closeModal(), 5000);
    }

    /**
     * Close the current modal and cancel any active stream.
     */
    closeModal() {
        if (!this.currentModal) return;

        // Cancel any active stream
        if (this.currentStreamId) {
            browser.runtime.sendMessage(createCancelStreamMessage(this.currentStreamId))
                .catch(error => {
                    console.log('Error cancelling stream:', error);
                });
            this.currentStreamId = null;
        }

        // Remove the keydown event listener if it exists
        const handler = /** @type {any} */ (this.currentModal)._keydownHandler;
        if (handler) {
            document.removeEventListener('keydown', handler);
        }

        this.currentModal.destroy();
        this.currentModal = null;
    }
}
