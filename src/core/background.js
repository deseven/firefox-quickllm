// Background script for QuickLLM extension.
// Provider logic is delegated to the provider abstraction in ./providers/.
import { getProvider, getDefaultEndpoint } from './providers/provider-registry.js';
import { loadProfiles } from '../utils/storage-utils.js';
import {
    MESSAGE_TYPES,
    createProcessContentMessage,
    createGetProfilesResponse,
    createLLMSuccessResponse,
    createLLMErrorResponse,
    createCancelStreamSuccessResponse,
    createCancelStreamErrorResponse,
    validateMessage
} from './messages.js';

/**
 * @typedef {import('../content/types.js').Profile} Profile
 * @typedef {import('./messages.js').ProcessWithLLMMessage} ProcessWithLLMMessage
 * @typedef {import('./providers/base-provider.js').ProviderContext} ProviderContext
 */

/**
 * Tracks cancellation state for an active stream.
 * @typedef {Object} StreamController
 * @property {boolean} cancelled - Whether the stream has been cancelled.
 */

class BackgroundManager {
    constructor() {
        /** @type {Map<string, StreamController>} */
        this.activeStreams = new Map(); // Track active streaming requests
        this.init();
    }

    init() {
        this.setupContextMenus();
        this.setupMessageHandlers();
        this.setupCommandHandlers();
        this.setupInstallHandler();
    }

    setupInstallHandler() {
        browser.runtime.onInstalled.addListener(() => {
            console.log('QuickLLM extension installed');
            this.setupContextMenus();
        });
        
        // Keep background script alive by listening to startup
        browser.runtime.onStartup.addListener(() => {
            console.log('QuickLLM extension started');
            this.setupContextMenus();
        });
    }

    async setupContextMenus() {
        // Check if profiles exist
        const result = await browser.storage.local.get('profiles');
        const profiles = result.profiles || [];
        const hasProfiles = profiles.length > 0;

        // Remove existing context menus
        browser.contextMenus.removeAll(() => {
            if (hasProfiles) {
                // Create single QuickLLM context menu item
                browser.contextMenus.create({
                    id: 'quickllm-process',
                    title: 'QuickLLM',
                    contexts: ['all']
                });
            }
        });
    }

    setupMessageHandlers() {
        browser.runtime.onMessage.addListener(
            /**
             * @param {any} message
             * @param {any} sender
             * @param {Function} sendResponse
             */
            (message, sender, sendResponse) => {
                // Validate the message shape before dispatching. Malformed messages
                // are logged and ignored rather than crashing the listener.
                const { valid, error } = validateMessage(message);
                if (!valid) {
                    console.warn('Rejecting invalid message:', error);
                    return false;
                }

                switch (message.type) {
                    case MESSAGE_TYPES.GET_PROFILES:
                        this.handleGetProfiles(sendResponse);
                        return true; // Keep message channel open for async response

                    case MESSAGE_TYPES.PROCESS_WITH_LLM:
                        this.handleLLMRequest(message, sender, sendResponse);
                        return true; // Keep message channel open for async response

                    case MESSAGE_TYPES.CANCEL_STREAM:
                        this.handleCancelStream(message, sender, sendResponse);
                        return true; // Async-capable: keep channel open for the response

                    case MESSAGE_TYPES.OPEN_POPUP:
                        this.openPopup();
                        return false; // Synchronous, no response payload needed

                    case MESSAGE_TYPES.PROFILES_UPDATED:
                        this.setupContextMenus();
                        return false; // Fire-and-forget, no response expected

                    default:
                        console.log('Unknown message type:', message.type);
                        return false;
                }
            }
        );

        // Handle context menu clicks
        browser.contextMenus.onClicked.addListener(
            /**
             * @param {any} info
             * @param {any} tab
             */
            (info, tab) => {
                this.handleContextMenuClick(info, tab);
            }
        );
    }

    setupCommandHandlers() {
        // Handle keyboard shortcuts defined in manifest.json
        browser.commands.onCommand.addListener(
            /** @param {any} command */
            (command) => {
                if (command === 'open-quickllm') {
                    // Get the active tab and send message to content script
                    browser.tabs.query({ active: true, currentWindow: true },
                        /** @param {any[]} tabs */
                        (tabs) => {
                            if (tabs[0]) {
                                browser.tabs.sendMessage(tabs[0].id, createProcessContentMessage());
                            }
                        }
                    );
                }
            }
        );
    }

    /**
     * Handle a getProfiles message.
     * @param {Function} sendResponse - Callback to send the response
     */
    async handleGetProfiles(sendResponse) {
        try {
            // loadProfiles deobfuscates API keys (and migrates any legacy
            // plaintext keys) so the popup and content script receive usable
            // plaintext keys to pass back with processWithLLM requests.
            const profiles = await loadProfiles();
            sendResponse(createGetProfilesResponse(profiles));
        } catch (error) {
            console.error('Error getting profiles:', error);
            sendResponse(createGetProfilesResponse([], /** @type {Error} */ (error).message));
        }
    }

    /**
     * Handle a processWithLLM message: look up the provider, build the
     * context, and delegate to the provider's process() method.
     * @param {ProcessWithLLMMessage} message - The validated message payload
     * @param {Object} sender - The message sender (contains tab info)
     * @param {Function} sendResponse - Callback to send the response
     */
    async handleLLMRequest(message, sender, sendResponse) {
        try {
            const { profile, userPrompt, text, isStreaming = false, streamId } = message;

            if (!profile) {
                throw new Error('No profile available');
            }

            // Generate stream ID if not provided
            const currentStreamId = streamId || `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Process with LLM using streamlined approach
            const tabId = /** @type {any} */ (sender).tab?.id;
            const response = await this.processWithLLM(profile, userPrompt, text, isStreaming, tabId, currentStreamId);
            sendResponse(createLLMSuccessResponse(response, currentStreamId));

        } catch (error) {
            console.error('Error processing LLM request:', error);
            sendResponse(createLLMErrorResponse(/** @type {Error} */ (error).message));
        }
    }

    /**
     * Handle a cancelStream message.
     * @param {Object} message - The cancelStream message payload
     * @param {Object} sender - The message sender
     * @param {Function} sendResponse - Callback to send the response
     */
    handleCancelStream(message, sender, sendResponse) {
        const { streamId } = /** @type {any} */ (message);
        if (streamId && this.activeStreams.has(streamId)) {
            const streamController = this.activeStreams.get(streamId);
            if (streamController) {
                streamController.cancelled = true;
            }
            this.activeStreams.delete(streamId);
            console.log(`Stream ${streamId} cancelled`);
            sendResponse(createCancelStreamSuccessResponse());
        } else {
            sendResponse(createCancelStreamErrorResponse('Stream not found'));
        }
    }

    /**
     * Process text with an LLM provider.
     * @param {Profile} profile - The profile to use (includes apiKey, model, etc.)
     * @param {string} userPrompt - The user's prompt
     * @param {string} text - The text to process
     * @param {boolean} isStreaming - Whether to stream the response
     * @param {number} tabId - The tab ID to send stream updates to
     * @param {string} streamId - Unique stream identifier
     * @returns {Promise<string>} The full response text
     */
    async processWithLLM(profile, userPrompt, text, isStreaming, tabId, streamId) {
        const { type, apiKey, endpoint, model, extraOptions, systemPrompt } = profile;

        // Look up the provider for this profile type
        const provider = getProvider(type);
        if (!provider) {
            throw new Error('Unsupported profile type');
        }

        // Create stream controller for cancellation
        const streamController = { cancelled: false };
        if (isStreaming && streamId) {
            this.activeStreams.set(streamId, streamController);
        }

        try {
            // Get the effective endpoint (use default if not specified)
            const effectiveEndpoint = endpoint || getDefaultEndpoint(type);

            // Build the context object passed to the provider
            const context = {
                apiKey: apiKey || '',
                endpoint: effectiveEndpoint,
                model,
                systemPrompt: systemPrompt || '',
                userPrompt,
                text,
                extraOptions: extraOptions ?? null,
                isStreaming,
                tabId,
                streamId,
                streamController
            };

            // Delegate to the provider — streaming loop, cancellation, and
            // streamUpdate messaging all live in the base class.
            return await provider.process(context);
        } finally {
            // Clean up stream controller
            if (streamId && this.activeStreams.has(streamId)) {
                this.activeStreams.delete(streamId);
            }
        }
    }

    /**
     * Handle a context menu click.
     * @param {Object} info - Context menu click info
     * @param {Object} tab - The tab where the click occurred
     */
    handleContextMenuClick(info, tab) {
        const menuItemId = /** @type {any} */ (info).menuItemId;
        const tabId = /** @type {any} */ (tab).id;
        switch (menuItemId) {
            case 'quickllm-process':
                // Let content script determine if there's selected text or use page content
                browser.tabs.sendMessage(tabId, createProcessContentMessage());
                break;
        }
    }

    openPopup() {
        browser.browserAction.openPopup();
    }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();