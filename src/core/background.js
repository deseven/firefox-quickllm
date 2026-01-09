// Background script for QuickLLM extension using official SDKs
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { Ollama } from 'ollama/browser';

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
        
        // Create stream controller for cancellation
        const streamController = { cancelled: false };
        if (isStreaming && streamId) {
            this.activeStreams.set(streamId, streamController);
        }
        
        try {
            if (type === 'openai') {
                return await this.processWithOpenAI(apiKey, endpoint, model, systemPrompt, userPrompt, text, isStreaming, tabId, extraOptions, streamId, streamController);
            } else if (type === 'anthropic') {
                return await this.processWithAnthropic(apiKey, endpoint, model, systemPrompt, userPrompt, text, isStreaming, tabId, extraOptions, streamId, streamController);
            } else if (type === 'ollama') {
                return await this.processWithOllama(apiKey, endpoint, model, systemPrompt, userPrompt, text, isStreaming, tabId, extraOptions, streamId, streamController);
            } else {
                throw new Error('Unsupported profile type');
            }
        } finally {
            // Clean up stream controller
            if (streamId && this.activeStreams.has(streamId)) {
                this.activeStreams.delete(streamId);
            }
        }
    }

    // Helper function to merge extra options with base options
    mergeExtraOptions(baseOptions, extraOptions) {
        if (!extraOptions) {
            return baseOptions;
        }
        
        let parsedExtraOptions = {};
        try {
            parsedExtraOptions = JSON.parse(extraOptions);
        } catch (error) {
            console.warn('Invalid extra options JSON, ignoring:', error);
            return baseOptions;
        }
        
        // Merge options, but don't overwrite critical fields like model
        const merged = { ...parsedExtraOptions, ...baseOptions };
        return merged;
    }

    async processWithOpenAI(apiKey, endpoint, model, systemPrompt, userPrompt, text, isStreaming, tabId, extraOptions, streamId, streamController) {
        const openai = new OpenAI({
            apiKey: apiKey || 'dummy-key', // Some APIs don't require keys but OpenAI SDK requires a value
            baseURL: endpoint || undefined,
            dangerouslyAllowBrowser: true
        });
        
        const messages = [];
        
        // System prompt
        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }
        
        // User prompt (if defined)
        if (userPrompt) {
            messages.push({ role: 'user', content: userPrompt });
        }
        
        // Text to process becomes user message
        messages.push({ role: 'user', content: text });

        // Base options that should not be overwritten
        const baseOptions = {
            model: model,
            messages: messages
        };

        if (isStreaming) {
            const streamOptions = this.mergeExtraOptions({ ...baseOptions, stream: true }, extraOptions);
            
            // Check if cancelled before making request
            if (streamController && streamController.cancelled) {
                throw new Error('Request cancelled');
            }
            
            const stream = await openai.chat.completions.create(streamOptions);

            let fullResponse = '';
            for await (const chunk of stream) {
                // Check if cancelled during streaming
                if (streamController && streamController.cancelled) {
                    break;
                }
                
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    fullResponse += content;
                    // Send update to content script with streamId
                    browser.tabs.sendMessage(tabId, {
                        type: 'streamUpdate',
                        content: fullResponse,
                        streamId: streamId
                    });
                }
            }
            return fullResponse;
        } else {
            // Check if cancelled before making request
            if (streamController && streamController.cancelled) {
                throw new Error('Request cancelled');
            }
            
            const completionOptions = this.mergeExtraOptions(baseOptions, extraOptions);
            const completion = await openai.chat.completions.create(completionOptions);
            return completion.choices[0].message.content;
        }
    }

    async processWithAnthropic(apiKey, endpoint, model, systemPrompt, userPrompt, text, isStreaming, tabId, extraOptions, streamId, streamController) {
        const anthropic = new Anthropic({
            apiKey: apiKey || 'dummy-key', // Some APIs don't require keys but Anthropic SDK requires a value
            baseURL: endpoint || undefined,
            dangerouslyAllowBrowser: true
        });
        
        const messages = [];
        
        // User prompt (if defined)
        if (userPrompt) {
            messages.push({ role: 'user', content: userPrompt });
        }
        
        // Text to process becomes user message
        messages.push({ role: 'user', content: text });

        const baseOptions = {
            model: model,
            messages: messages,
            max_tokens: 4096  // Required by Anthropic API
        };

        // System prompt
        if (systemPrompt) {
            baseOptions.system = systemPrompt;
        }

        if (isStreaming) {
            // Check if cancelled before making request
            if (streamController && streamController.cancelled) {
                throw new Error('Request cancelled');
            }
            
            const streamOptions = this.mergeExtraOptions({ ...baseOptions, stream: true }, extraOptions);
            const stream = await anthropic.messages.create(streamOptions);

            let fullResponse = '';
            for await (const chunk of stream) {
                // Check if cancelled during streaming
                if (streamController && streamController.cancelled) {
                    break;
                }
                
                if (chunk.type === 'content_block_delta') {
                    const content = chunk.delta.text || '';
                    if (content) {
                        fullResponse += content;
                        // Send update to content script with streamId
                        browser.tabs.sendMessage(tabId, {
                            type: 'streamUpdate',
                            content: fullResponse,
                            streamId: streamId
                        });
                    }
                }
            }
            return fullResponse;
        } else {
            // Check if cancelled before making request
            if (streamController && streamController.cancelled) {
                throw new Error('Request cancelled');
            }
            
            const requestOptions = this.mergeExtraOptions(baseOptions, extraOptions);
            const message = await anthropic.messages.create(requestOptions);
            return message.content[0].text;
        }
    }

    async processWithOllama(apiKey, endpoint, model, systemPrompt, userPrompt, text, isStreaming, tabId, extraOptions, streamId, streamController) {
        const ollama = new Ollama({
            host: endpoint || 'http://localhost:11434'
        });
        
        // Build the prompt with system prompt and user prompt if provided
        let prompt = '';
        if (systemPrompt) {
            prompt += systemPrompt + '\n\n';
        }
        if (userPrompt) {
            prompt += userPrompt + '\n\n';
        }
        prompt += text;

        const baseOptions = {
            model: model,
            prompt: prompt
        };

        if (isStreaming) {
            // Check if cancelled before making request
            if (streamController && streamController.cancelled) {
                throw new Error('Request cancelled');
            }
            
            const streamOptions = this.mergeExtraOptions({ ...baseOptions, stream: true }, extraOptions);
            const stream = await ollama.generate(streamOptions);

            let fullResponse = '';
            for await (const chunk of stream) {
                // Check if cancelled during streaming
                if (streamController && streamController.cancelled) {
                    break;
                }
                
                if (chunk.response) {
                    fullResponse += chunk.response;
                    // Send update to content script with streamId
                    browser.tabs.sendMessage(tabId, {
                        type: 'streamUpdate',
                        content: fullResponse,
                        streamId: streamId
                    });
                }
            }
            return fullResponse;
        } else {
            // Check if cancelled before making request
            if (streamController && streamController.cancelled) {
                throw new Error('Request cancelled');
            }
            
            const generateOptions = this.mergeExtraOptions(baseOptions, extraOptions);
            const response = await ollama.generate(generateOptions);
            return response.response;
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