// Background script for QuickLLM extension.
// Provider logic is delegated to the provider abstraction in ./providers/.
// See ARCHITECTURE_REVIEW.md item 1 for the rationale behind this design.
import { getProvider, getDefaultEndpoint } from './providers/provider-registry.js';

class BackgroundManager {
    constructor() {
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
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'getProfiles':
                    this.handleGetProfiles(sendResponse);
                    return true; // Keep message channel open for async response

                case 'processWithLLM':
                    this.handleLLMRequest(message, sender, sendResponse);
                    return true; // Keep message channel open for async response

                case 'cancelStream':
                    this.handleCancelStream(message, sender, sendResponse);
                    break;

                case 'openPopup':
                    this.openPopup();
                    break;

                case 'profilesUpdated':
                    this.setupContextMenus();
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        });

        // Handle context menu clicks
        browser.contextMenus.onClicked.addListener((info, tab) => {
            this.handleContextMenuClick(info, tab);
        });
    }

    setupCommandHandlers() {
        // Handle keyboard shortcuts defined in manifest.json
        browser.commands.onCommand.addListener((command) => {
            if (command === 'open-quickllm') {
                // Get the active tab and send message to content script
                browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        browser.tabs.sendMessage(tabs[0].id, {
                            type: 'processContent'
                        });
                    }
                });
            }
        });
    }

    async handleGetProfiles(sendResponse) {
        try {
            const result = await browser.storage.local.get('profiles');
            sendResponse({ profiles: result.profiles || [] });
        } catch (error) {
            console.error('Error getting profiles:', error);
            sendResponse({ profiles: [], error: error.message });
        }
    }

    async handleLLMRequest(message, sender, sendResponse) {
        try {
            const { profile, userPrompt, text, isStreaming = false, streamId } = message;
            
            if (!profile) {
                throw new Error('No profile available');
            }

            // Generate stream ID if not provided
            const currentStreamId = streamId || `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Process with LLM using streamlined approach
            const response = await this.processWithLLM(profile, userPrompt, text, isStreaming, sender.tab.id, currentStreamId);
            sendResponse({ success: true, response, streamId: currentStreamId });

        } catch (error) {
            console.error('Error processing LLM request:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    handleCancelStream(message, sender, sendResponse) {
        const { streamId } = message;
        if (streamId && this.activeStreams.has(streamId)) {
            const streamController = this.activeStreams.get(streamId);
            streamController.cancelled = true;
            this.activeStreams.delete(streamId);
            console.log(`Stream ${streamId} cancelled`);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Stream not found' });
        }
    }

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
                apiKey,
                endpoint: effectiveEndpoint,
                model,
                systemPrompt,
                userPrompt,
                text,
                extraOptions,
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

    handleContextMenuClick(info, tab) {
        switch (info.menuItemId) {
            case 'quickllm-process':
                // Let content script determine if there's selected text or use page content
                browser.tabs.sendMessage(tab.id, {
                    type: 'processContent'
                });
                break;
        }
    }

    openPopup() {
        browser.browserAction.openPopup();
    }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();