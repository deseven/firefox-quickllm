// Content script for QuickLLM extension
import { escapeHtml, prefersDarkMode } from '../utils/utils.js';
import markdownRenderer from '../utils/markdown-renderer.js';
import ShadowModal from '../utils/shadow-modal.js';
import TurndownService from 'turndown';

class ContentManager {
    constructor() {
        this.currentModal = null;
        this.currentElement = null;
        this.currentStreamId = null;
        this.init();
    }

    init() {
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'processContent':
                    this.handleProcessContent();
                    break;

                case 'streamUpdate':
                    this.updateStreamingResponse(message.content, message.streamId);
                    break;

                default:
                    console.log('Unknown message type:', message.type);
            }
        });
    }

    async handleProcessContent() {
        // Get selected text using the browser's selection API
        const selectedText = this.getSelectedText();
        
        if (selectedText && selectedText.trim()) {
            // Process selected text
            this.showPromptModal(selectedText, 'selected text');
        } else {
            // Process page content
            const pageText = this.getPageText();
            if (!pageText.trim()) {
                await this.showError('No text found on this page');
                return;
            }
            this.showPromptModal(pageText, 'page content');
        }
    }

    getSelectedText() {
        const selection = window.getSelection();
        return selection.toString().trim();
    }


    getPageText() {
        // Get main content, avoiding navigation, ads, etc.
        const contentSelectors = [
            'main', 'article', '[role="main"]', '.content', '#content',
            '.post', '.entry', '.article-body', '.story-body'
        ];
        
        let element = null;
        for (const selector of contentSelectors) {
            element = document.querySelector(selector);
            if (element) {
                break;
            }
        }
        
        // Fallback to body if no main content found
        if (!element) {
            element = document.body;
        }
        
        if (!element) {
            return '';
        }
        
        // Clone the element to avoid modifying the original
        const clonedElement = element.cloneNode(true);
        
        // Remove unwanted elements (scripts, styles, navigation, ads, etc.)
        const unwantedSelectors = [
            'script', 'style', 'noscript', 'iframe', 'object', 'embed',
            'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
            '.menu', '.ads', '.advertisement', '.social', '.share',
            '.comments', '.comment', '.related', '.recommended'
        ];
        
        unwantedSelectors.forEach(selector => {
            const elements = clonedElement.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        
        // Initialize Turndown service with options for better formatting
        const turndownService = new TurndownService({
            headingStyle: 'atx',
            bulletListMarker: '-',
            codeBlockStyle: 'fenced',
            fence: '```',
            emDelimiter: '*',
            strongDelimiter: '**',
            linkStyle: 'inlined'
        });
        
        // Add custom rule to remove media elements completely
        turndownService.addRule('removeMedia', {
            filter: function (node) {
                return node.nodeName === 'IMG' ||
                       node.nodeName === 'VIDEO' ||
                       node.nodeName === 'AUDIO' ||
                       node.nodeName === 'SVG';
            },
            replacement: function () {
                return ''; // Return empty string to completely remove the element
            }
        });
        
        // Convert HTML to Markdown, which preserves structure better than plain text
        let markdown = turndownService.turndown(clonedElement);
        
        // Clean up excessive whitespace while preserving meaningful line breaks
        markdown = markdown
            .replace(/\n{4,}/g, '\n\n\n')  // Limit consecutive newlines to max 3
            .replace(/[ \t]+/g, ' ')       // Replace multiple spaces/tabs with single space
            .replace(/[ \t]*\n[ \t]*/g, '\n') // Remove spaces around newlines
            .trim();
        
        return markdown;
    }

    async showPromptModal(text, textType, selectedProfile = null, bypassProcessImmediately = false) {
        // Get profiles
        const profilesResponse = await browser.runtime.sendMessage({ type: 'getProfiles' });
        const profiles = profilesResponse.profiles || [];
        
        if (profiles.length === 0) {
            await this.showError('No profiles configured. Please add a profile first.');
            return;
        }

        // If no profile selected and multiple profiles exist, show profile selector first
        if (!selectedProfile && profiles.length > 1) {
            await this.showProfileSelector(profiles, text, textType);
            return;
        }

        // Use selected profile or first available profile
        const profile = selectedProfile || profiles[0];
        const prefersDark = await prefersDarkMode();

        // User prompt is always editable now
        const shouldProcessImmediately = profile.processImmediately && !bypassProcessImmediately;
        
        const modalContent = `
            <div class="quickllm-modal-content">
                <div class="quickllm-modal-header">
                    <h3 class="quickllm-modal-title">Process ${textType}</h3>
                    <button class="quickllm-close-btn">&times;</button>
                </div>
                
                <div class="quickllm-modal-body">
                    <div class="quickllm-modal-left">
                        <div class="quickllm-form-group">
                            <label class="quickllm-label">Text to process:</label>
                            <div class="quickllm-text-preview">${escapeHtml(text.substring(0, 500))}${text.length > 500 ? '...' : ''}</div>
                        </div>
                        
                        <div class="quickllm-form-group">
                            <label class="quickllm-label">System Prompt:</label>
                            <input type="text" class="quickllm-input" id="quickllm-system-prompt" readonly value="${profile.systemPrompt || 'No system prompt configured'}" style="background-color: ${prefersDark ? '#2a2a2a' : '#f5f5f5'}; cursor: default;">
                        </div>
                        
                        <div class="quickllm-form-group">
                            <label class="quickllm-label">User Prompt:</label>
                            <textarea class="quickllm-input" id="quickllm-user-prompt" placeholder="Enter your user prompt (Shift+Enter for new line)" rows="3">${profile.userPrompt || ''}</textarea>
                        </div>
                        
                        <div class="quickllm-form-group">
                            <div style="font-size: 8px; color: ${prefersDark ? '#aaa' : '#666'}; margin-top: 8px;">
                                <strong>Profile:</strong> ${escapeHtml(profile.name)} (${profile.type})<br>
                                <strong>Keyboard shortcuts:</strong><br>
                                • Enter: Process<br>
                                • Shift+Enter: New line in prompt<br>
                                • Enter again after response: Copy & Close<br>
                                • Escape: Close
                            </div>
                        </div>
                    </div>
                    
                    <div class="quickllm-modal-right">
                        <div id="quickllm-response-container" style="display: flex; flex: 1; flex-direction: column; min-height: 0;">
                            <label class="quickllm-label" style="flex-shrink: 0;">AI Response:</label>
                            <div class="quickllm-response" id="quickllm-response" style="flex: 1; overflow-y: auto; min-height: 0;"></div>
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid ${prefersDark ? '#444' : '#e5e5e5'};">
                    <div>
                        <button class="quickllm-btn" id="quickllm-process">Process</button>
                    </div>
                    <div>
                        <button class="quickllm-btn" id="quickllm-copy" style="display: none;">Copy</button>
                    </div>
                </div>
            </div>
        `;

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(modalContent, {
            darkTheme: prefersDark,
            onClose: () => this.closeModal()
        });

        // Event listeners
        const processBtn = this.currentModal.querySelector('#quickllm-process');
        const userPromptInput = this.currentModal.querySelector('#quickllm-user-prompt');
        
        // Store the original prompt for comparison
        let originalPrompt = userPromptInput.value.trim();
        let hasResponse = false;
        let hasProcessedOnce = false;
        
        processBtn.addEventListener('click', async () => {
            originalPrompt = userPromptInput.value.trim();
            hasResponse = false;
            await this.processWithProfile(text, profile, originalPrompt);
            hasResponse = true;
            hasProcessedOnce = true;
        });

        // Keyboard shortcuts
        const handleKeyDown = (e) => {
            // Only handle shortcuts if the modal is currently open
            if (!this.currentModal) {
                return;
            }
            
            // Enter: Process or Copy & Close (only if prompt unchanged)
            if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                const copyBtn = this.currentModal.querySelector('#quickllm-copy');
                const currentPrompt = userPromptInput.value.trim();
                
                if (copyBtn && copyBtn.style.display !== 'none' && hasResponse && hasProcessedOnce && currentPrompt === originalPrompt) {
                    // If response is available and prompt hasn't changed, copy and close
                    copyBtn.click();
                } else {
                    // Otherwise, process (either no response yet or prompt has changed)
                    processBtn.click();
                }
            }
            // Escape: Close modal
            else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeModal();
            }
        };

        // Add keyboard event listener to the document so it works regardless of focus
        document.addEventListener('keydown', handleKeyDown);
        
        // Store the handler so we can remove it when the modal closes
        this.currentModal._keydownHandler = handleKeyDown;

        // Add keyboard handlers directly to the textarea to handle Enter/Escape when focused
        userPromptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                const copyBtn = this.currentModal.querySelector('#quickllm-copy');
                const currentPrompt = userPromptInput.value.trim();
                
                if (copyBtn && copyBtn.style.display !== 'none' && hasResponse && hasProcessedOnce && currentPrompt === originalPrompt) {
                    copyBtn.click();
                } else {
                    processBtn.click();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.closeModal();
            }
            // Shift+Enter is allowed to pass through for line breaks in textarea
        });

        // Always focus on user prompt input and select all text
        setTimeout(() => {
            userPromptInput.focus();
            userPromptInput.select();
        }, 100);

        // If should process immediately, do it now
        if (shouldProcessImmediately) {
            setTimeout(async () => {
                hasResponse = false;
                await this.processWithProfile(text, profile, profile.userPrompt || '');
                hasResponse = true;
                hasProcessedOnce = true;
            }, 100);
        }
    }

    async showProfileSelector(profiles, text, textType) {
        const prefersDark = await prefersDarkMode();
        
        const modalContent = `
            <div class="quickllm-modal-content" style="max-width: 400px; min-height: auto; max-height: 90vh; overflow: hidden;">
                <div class="quickllm-modal-header">
                    <h3 class="quickllm-modal-title">Select Profile</h3>
                    <button class="quickllm-close-btn">&times;</button>
                </div>
                
                <div class="quickllm-profile-list" id="quickllm-profile-list">
                    ${profiles.map((profile, index) => `
                        <div class="quickllm-profile-item ${index === 0 ? 'selected' : ''}" data-profile-id="${profile.id}" data-index="${index}">
                            <div style="display: flex; align-items: center; margin-bottom: 4px;">
                                ${index < 10 ? `<span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background-color: ${prefersDark ? '#444' : '#e5e5e5'}; color: ${prefersDark ? '#ccc' : '#666'}; border-radius: 3px; font-size: 11px; font-weight: 600; margin-right: 8px; flex-shrink: 0;">${index === 9 ? '0' : (index + 1)}</span>` : ''}
                                <div style="font-weight: 600; word-wrap: break-word; overflow: hidden; text-overflow: ellipsis; flex: 1;">${escapeHtml(profile.name)}</div>
                            </div>
                            <div style="font-size: 12px; color: ${prefersDark ? '#ccc' : '#666'}; word-wrap: break-word; overflow: hidden; text-overflow: ellipsis; ${index < 10 ? 'margin-left: 28px;' : ''}">${profile.type} - ${escapeHtml(profile.model)}</div>
                        </div>
                    `).join('')}
                </div>
                
                <div style="margin-top: 16px; font-size: 12px; color: ${prefersDark ? '#aaa' : '#666'};">
                    • Use arrow keys or number keys (1-0) to select a profile<br>
                    • Enter to select<br>
                    • Escape to cancel<br>
                    • Hold Shift while selecting to bypass "Process immediately"
                </div>
            </div>
        `;

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(modalContent, {
            darkTheme: prefersDark,
            onClose: () => this.closeModal()
        });

        let selectedIndex = 0;
        const profileItems = this.currentModal.querySelectorAll('.quickllm-profile-item');

        const updateSelection = () => {
            profileItems.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
        };

        const selectProfile = (bypassProcessImmediately = false) => {
            const selectedProfile = profiles[selectedIndex];
            this.closeModal();
            this.showPromptModal(text, textType, selectedProfile, bypassProcessImmediately);
        };

        // Event listeners
        profileItems.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                selectedIndex = index;
                const bypassProcessImmediately = e.shiftKey;
                selectProfile(bypassProcessImmediately);
            });
        });

        // Keyboard navigation
        const handleKeyDown = (e) => {
            if (!this.currentModal) {
                return;
            }
            
            // Handle number keys 1-0 for profile selection
            if ((e.code >= 'Digit1' && e.code <= 'Digit9') || e.code === 'Digit0') {
                const profileIndex = e.code === 'Digit0' ? 9 : parseInt(e.code.slice(-1)) - 1;
                if (profileIndex < profiles.length) {
                    e.preventDefault();
                    selectedIndex = profileIndex;
                    updateSelection();
                    const bypassProcessImmediately = e.shiftKey;
                    selectProfile(bypassProcessImmediately);
                }
                return;
            }
            
            switch (e.key) {
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(0, selectedIndex - 1);
                    updateSelection();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(profiles.length - 1, selectedIndex + 1);
                    updateSelection();
                    break;
                case 'Enter':
                    e.preventDefault();
                    const bypassProcessImmediately = e.shiftKey;
                    selectProfile(bypassProcessImmediately);
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.closeModal();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        this.currentModal._keydownHandler = handleKeyDown;

        // Initialize selection
        updateSelection();
    }

    async processWithProfile(text, profile, userPrompt) {
        const responseElement = this.currentModal.querySelector('#quickllm-response');
        const processBtn = this.currentModal.querySelector('#quickllm-process');
        const userPromptInput = this.currentModal.querySelector('#quickllm-user-prompt');
        
        // Generate unique stream ID for this request
        const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.currentStreamId = streamId;
        
        // Show loading state
        responseElement.innerHTML = `
            <div class="quickllm-loading">
                <div class="quickllm-spinner"></div>
                Processing...
            </div>
        `;
        processBtn.disabled = true;
        userPromptInput.disabled = true;

        try {
            // Send system prompt, user prompt, and text as separate messages
            const response = await browser.runtime.sendMessage({
                type: 'processWithLLM',
                profile: profile,
                userPrompt: userPrompt,
                text: text,
                isStreaming: true,
                streamId: streamId
            });

            if (response.success) {
                // Only process if this is still the current stream
                if (this.currentStreamId === streamId) {
                    // Render response as markdown
                    const renderedContent = markdownRenderer.render(response.response);
                    responseElement.innerHTML = renderedContent;
                    responseElement.classList.add('markdown-content');
                    
                    // Show copy button now that we have a response
                    const copyBtn = this.currentModal.querySelector('#quickllm-copy');
                    if (copyBtn) {
                        copyBtn.style.display = 'inline-block';
                        copyBtn.addEventListener('click', () => {
                            navigator.clipboard.writeText(response.response);
                            this.closeModal();
                        });
                    }
                }
            } else {
                // Only show error if this is still the current stream
                if (this.currentStreamId === streamId) {
                    throw new Error(response.error);
                }
            }
        } catch (error) {
            // Only show error if this is still the current stream
            if (this.currentStreamId === streamId) {
                responseElement.innerHTML = `<div style="color: #dc3545;">Error: ${escapeHtml(error.message)}</div>`;
            }
        } finally {
            // Only re-enable controls if this is still the current stream
            if (this.currentStreamId === streamId) {
                processBtn.disabled = false;
                userPromptInput.disabled = false;
                // Focus back on user prompt input and select all text for convenience
                setTimeout(() => {
                    userPromptInput.focus();
                    userPromptInput.select();
                }, 50);
            }
        }
    }

    updateStreamingResponse(content, streamId) {
        // Only update if this is the current stream and modal is open
        if (this.currentModal && this.currentStreamId === streamId) {
            const responseElement = this.currentModal.querySelector('#quickllm-response');
            if (responseElement) {
                // Render streaming content as markdown
                const renderedContent = markdownRenderer.render(content);
                responseElement.innerHTML = renderedContent;
                responseElement.classList.add('markdown-content');
            }
        }
    }

    async showResponseModal(content) {
        const prefersDark = await prefersDarkMode();
        
        const modalContent = `
            <div class="quickllm-modal-content">
                <div class="quickllm-modal-header">
                    <h3 class="quickllm-modal-title">AI Response</h3>
                    <button class="quickllm-close-btn">&times;</button>
                </div>
                
                <div class="quickllm-response markdown-content">${markdownRenderer.render(content)}</div>
                
                <div style="margin-top: 16px;">
                    <button class="quickllm-btn" id="quickllm-copy-response">Copy</button>
                    <button class="quickllm-btn quickllm-btn-secondary" id="quickllm-close-response">Close</button>
                </div>
            </div>
        `;

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(modalContent, {
            darkTheme: prefersDark,
            onClose: () => this.closeModal()
        });

        // Event listeners
        this.currentModal.addEventListener('#quickllm-close-response', 'click', () => this.closeModal());
        this.currentModal.addEventListener('#quickllm-copy-response', 'click', () => {
            navigator.clipboard.writeText(content);
            this.closeModal();
        });
    }

    async showError(message) {
        const prefersDark = await prefersDarkMode();
        
        const modalContent = `
            <div class="quickllm-modal-content">
                <div class="quickllm-modal-header">
                    <h3 class="quickllm-modal-title">Error</h3>
                    <button class="quickllm-close-btn">&times;</button>
                </div>
                
                <div style="color: #dc3545; padding: 16px;">
                    ${escapeHtml(message)}
                </div>
                
                <div style="margin-top: 16px;">
                    <button class="quickllm-btn quickllm-btn-secondary" id="quickllm-close-error">Close</button>
                </div>
            </div>
        `;

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(modalContent, {
            darkTheme: prefersDark,
            onClose: () => this.closeModal()
        });

        // Event listeners
        this.currentModal.addEventListener('#quickllm-close-error', 'click', () => this.closeModal());
        
        // Auto close after 5 seconds
        setTimeout(() => this.closeModal(), 5000);
    }

    closeModal() {
        if (this.currentModal) {
            // Cancel any active stream
            if (this.currentStreamId) {
                browser.runtime.sendMessage({
                    type: 'cancelStream',
                    streamId: this.currentStreamId
                }).catch(error => {
                    console.log('Error cancelling stream:', error);
                });
                this.currentStreamId = null;
            }
            
            // Remove the keydown event listener if it exists
            if (this.currentModal._keydownHandler) {
                document.removeEventListener('keydown', this.currentModal._keydownHandler);
            }
            // Destroy the shadow modal
            this.currentModal.destroy();
            this.currentModal = null;
        }
    }

}

// Initialize content manager
const contentManager = new ContentManager();