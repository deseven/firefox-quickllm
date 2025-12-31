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

    // Helper function to create DOM elements programmatically
    createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.className) element.className = options.className;
        if (options.id) element.id = options.id;
        if (options.textContent) element.textContent = options.textContent;
        if (options.style) {
            if (typeof options.style === 'string') {
                element.style.cssText = options.style;
            } else {
                Object.assign(element.style, options.style);
            }
        }
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        if (options.children) {
            options.children.forEach(child => {
                if (typeof child === 'string') {
                    element.appendChild(document.createTextNode(child));
                } else {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    }

    // Helper to safely render markdown content to DOM
    renderMarkdownToElement(content, targetElement) {
        // Clear existing content
        while (targetElement.firstChild) {
            targetElement.removeChild(targetElement.firstChild);
        }
        
        // Render markdown and create a temporary container
        const renderedContent = markdownRenderer.render(content);
        const parser = new DOMParser();
        const doc = parser.parseFromString(renderedContent, 'text/html');
        
        // Move all children from parsed document to target element
        const bodyChildren = Array.from(doc.body.childNodes);
        bodyChildren.forEach(child => {
            targetElement.appendChild(child);
        });
        
        targetElement.classList.add('markdown-content');
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
        
        const createModalContent = () => {
            const modalContent = this.createElement('div', { className: 'quickllm-modal-content' });
            
            // Header
            const header = this.createElement('div', { className: 'quickllm-modal-header' });
            const title = this.createElement('h3', {
                className: 'quickllm-modal-title',
                textContent: `Process ${textType}`
            });
            const closeBtn = this.createElement('button', {
                className: 'quickllm-close-btn',
                textContent: '×'
            });
            header.appendChild(title);
            header.appendChild(closeBtn);
            
            // Body
            const body = this.createElement('div', { className: 'quickllm-modal-body' });
            
            // Left side
            const leftSide = this.createElement('div', { className: 'quickllm-modal-left' });
            
            // Text to process
            const textGroup = this.createElement('div', { className: 'quickllm-form-group' });
            const textLabel = this.createElement('label', {
                className: 'quickllm-label',
                textContent: 'Text to process:'
            });
            const textPreview = this.createElement('div', {
                className: 'quickllm-text-preview',
                textContent: text.substring(0, 500) + (text.length > 500 ? '...' : '')
            });
            textGroup.appendChild(textLabel);
            textGroup.appendChild(textPreview);
            
            // System prompt
            const systemGroup = this.createElement('div', { className: 'quickllm-form-group' });
            const systemLabel = this.createElement('label', {
                className: 'quickllm-label',
                textContent: 'System Prompt:'
            });
            const systemInput = this.createElement('input', {
                className: 'quickllm-input',
                id: 'quickllm-system-prompt',
                attributes: {
                    type: 'text',
                    readonly: true,
                    value: profile.systemPrompt || 'No system prompt configured'
                },
                style: {
                    backgroundColor: prefersDark ? '#2a2a2a' : '#f5f5f5',
                    cursor: 'default'
                }
            });
            systemGroup.appendChild(systemLabel);
            systemGroup.appendChild(systemInput);
            
            // User prompt
            const userGroup = this.createElement('div', { className: 'quickllm-form-group' });
            const userLabel = this.createElement('label', {
                className: 'quickllm-label',
                textContent: 'User Prompt:'
            });
            const userTextarea = this.createElement('textarea', {
                className: 'quickllm-input',
                id: 'quickllm-user-prompt',
                attributes: {
                    placeholder: 'Enter your user prompt (Shift+Enter for new line)',
                    rows: '3'
                },
                textContent: profile.userPrompt || ''
            });
            userGroup.appendChild(userLabel);
            userGroup.appendChild(userTextarea);
            
            // Info section
            const infoGroup = this.createElement('div', { className: 'quickllm-form-group' });
            const infoDiv = this.createElement('div', {
                style: {
                    fontSize: '8px',
                    color: prefersDark ? '#aaa' : '#666',
                    marginTop: '8px'
                }
            });
            
            const profileInfo = this.createElement('strong', { textContent: 'Profile: ' });
            const profileText = document.createTextNode(`${profile.name} (${profile.type})`);
            const br1 = document.createElement('br');
            const shortcutsInfo = this.createElement('strong', { textContent: 'Keyboard shortcuts:' });
            const br2 = document.createElement('br');
            const shortcuts = document.createTextNode('• Enter: Process\n• Shift+Enter: New line in prompt\n• Enter again after response: Copy & Close\n• Escape: Close');
            
            infoDiv.appendChild(profileInfo);
            infoDiv.appendChild(profileText);
            infoDiv.appendChild(br1);
            infoDiv.appendChild(shortcutsInfo);
            infoDiv.appendChild(br2);
            infoDiv.appendChild(shortcuts);
            infoGroup.appendChild(infoDiv);
            
            leftSide.appendChild(textGroup);
            leftSide.appendChild(systemGroup);
            leftSide.appendChild(userGroup);
            leftSide.appendChild(infoGroup);
            
            // Right side
            const rightSide = this.createElement('div', { className: 'quickllm-modal-right' });
            const responseContainer = this.createElement('div', {
                id: 'quickllm-response-container',
                style: {
                    display: 'flex',
                    flex: '1',
                    flexDirection: 'column',
                    minHeight: '0'
                }
            });
            const responseLabel = this.createElement('label', {
                className: 'quickllm-label',
                textContent: 'AI Response:',
                style: { flexShrink: '0' }
            });
            const responseDiv = this.createElement('div', {
                className: 'quickllm-response',
                id: 'quickllm-response',
                style: {
                    flex: '1',
                    overflowY: 'auto',
                    minHeight: '0'
                }
            });
            responseContainer.appendChild(responseLabel);
            responseContainer.appendChild(responseDiv);
            rightSide.appendChild(responseContainer);
            
            body.appendChild(leftSide);
            body.appendChild(rightSide);
            
            // Footer
            const footer = this.createElement('div', {
                style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '20px',
                    paddingTop: '16px',
                    borderTop: `1px solid ${prefersDark ? '#444' : '#e5e5e5'}`
                }
            });
            
            const leftFooter = this.createElement('div');
            const processBtn = this.createElement('button', {
                className: 'quickllm-btn',
                id: 'quickllm-process',
                textContent: 'Process'
            });
            leftFooter.appendChild(processBtn);
            
            const rightFooter = this.createElement('div');
            const copyBtn = this.createElement('button', {
                className: 'quickllm-btn',
                id: 'quickllm-copy',
                textContent: 'Copy',
                style: { display: 'none' }
            });
            rightFooter.appendChild(copyBtn);
            
            footer.appendChild(leftFooter);
            footer.appendChild(rightFooter);
            
            modalContent.appendChild(header);
            modalContent.appendChild(body);
            modalContent.appendChild(footer);
            
            return modalContent;
        };

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(createModalContent, {
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
        
        const createModalContent = () => {
            const modalContent = this.createElement('div', {
                className: 'quickllm-modal-content',
                style: {
                    maxWidth: '400px',
                    minHeight: 'auto',
                    maxHeight: '90vh',
                    overflow: 'hidden'
                }
            });
            
            // Header
            const header = this.createElement('div', { className: 'quickllm-modal-header' });
            const title = this.createElement('h3', {
                className: 'quickllm-modal-title',
                textContent: 'Select Profile'
            });
            const closeBtn = this.createElement('button', {
                className: 'quickllm-close-btn',
                textContent: '×'
            });
            header.appendChild(title);
            header.appendChild(closeBtn);
            
            // Profile list
            const profileList = this.createElement('div', {
                className: 'quickllm-profile-list',
                id: 'quickllm-profile-list'
            });
            
            profiles.forEach((profile, index) => {
                const profileItem = this.createElement('div', {
                    className: `quickllm-profile-item ${index === 0 ? 'selected' : ''}`,
                    attributes: {
                        'data-profile-id': profile.id,
                        'data-index': index.toString()
                    }
                });
                
                const profileHeader = this.createElement('div', {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '4px'
                    }
                });
                
                if (index < 10) {
                    const numberSpan = this.createElement('span', {
                        textContent: index === 9 ? '0' : (index + 1).toString(),
                        style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            backgroundColor: prefersDark ? '#444' : '#e5e5e5',
                            color: prefersDark ? '#ccc' : '#666',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: '600',
                            marginRight: '8px',
                            flexShrink: '0'
                        }
                    });
                    profileHeader.appendChild(numberSpan);
                }
                
                const profileName = this.createElement('div', {
                    textContent: profile.name,
                    style: {
                        fontWeight: '600',
                        wordWrap: 'break-word',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: '1'
                    }
                });
                profileHeader.appendChild(profileName);
                
                const profileDetails = this.createElement('div', {
                    textContent: `${profile.type} - ${profile.model}`,
                    style: {
                        fontSize: '12px',
                        color: prefersDark ? '#ccc' : '#666',
                        wordWrap: 'break-word',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginLeft: index < 10 ? '28px' : '0'
                    }
                });
                
                profileItem.appendChild(profileHeader);
                profileItem.appendChild(profileDetails);
                profileList.appendChild(profileItem);
            });
            
            // Instructions
            const instructions = this.createElement('div', {
                style: {
                    marginTop: '16px',
                    fontSize: '12px',
                    color: prefersDark ? '#aaa' : '#666'
                }
            });
            
            const instructionLines = [
                '• Use arrow keys or number keys (1-0) to select a profile',
                '• Enter to select',
                '• Escape to cancel',
                '• Hold Shift while selecting to bypass "Process immediately"'
            ];
            
            instructionLines.forEach((line, index) => {
                if (index > 0) instructions.appendChild(document.createElement('br'));
                instructions.appendChild(document.createTextNode(line));
            });
            
            modalContent.appendChild(header);
            modalContent.appendChild(profileList);
            modalContent.appendChild(instructions);
            
            return modalContent;
        };

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(createModalContent, {
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
        
        // Show loading state - use DOM APIs for static content
        while (responseElement.firstChild) {
            responseElement.removeChild(responseElement.firstChild);
        }
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'quickllm-loading';
        
        const spinnerDiv = document.createElement('div');
        spinnerDiv.className = 'quickllm-spinner';
        
        const loadingText = document.createTextNode('Processing...');
        
        loadingDiv.appendChild(spinnerDiv);
        loadingDiv.appendChild(loadingText);
        responseElement.appendChild(loadingDiv);
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
                    // Render response as markdown using helper method
                    this.renderMarkdownToElement(response.response, responseElement);
                    
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
                // Use DOM APIs for error message
                while (responseElement.firstChild) {
                    responseElement.removeChild(responseElement.firstChild);
                }
                const errorDiv = document.createElement('div');
                errorDiv.style.color = '#dc3545';
                errorDiv.textContent = `Error: ${error.message}`;
                responseElement.appendChild(errorDiv);
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
                // Render streaming content as markdown using helper method
                this.renderMarkdownToElement(content, responseElement);
            }
        }
    }

    async showResponseModal(content) {
        const prefersDark = await prefersDarkMode();
        
        const createModalContent = () => {
            const modalContent = this.createElement('div', { className: 'quickllm-modal-content' });
            
            // Header
            const header = this.createElement('div', { className: 'quickllm-modal-header' });
            const title = this.createElement('h3', {
                className: 'quickllm-modal-title',
                textContent: 'AI Response'
            });
            const closeBtn = this.createElement('button', {
                className: 'quickllm-close-btn',
                textContent: '×'
            });
            header.appendChild(title);
            header.appendChild(closeBtn);
            
            // Response content
            const responseDiv = this.createElement('div', {
                className: 'quickllm-response markdown-content'
            });
            // Use helper method to render markdown content
            this.renderMarkdownToElement(content, responseDiv);
            
            // Buttons
            const buttonContainer = this.createElement('div', {
                style: { marginTop: '16px' }
            });
            
            const copyBtn = this.createElement('button', {
                className: 'quickllm-btn',
                id: 'quickllm-copy-response',
                textContent: 'Copy'
            });
            
            const closeResponseBtn = this.createElement('button', {
                className: 'quickllm-btn quickllm-btn-secondary',
                id: 'quickllm-close-response',
                textContent: 'Close'
            });
            
            buttonContainer.appendChild(copyBtn);
            buttonContainer.appendChild(closeResponseBtn);
            
            modalContent.appendChild(header);
            modalContent.appendChild(responseDiv);
            modalContent.appendChild(buttonContainer);
            
            return modalContent;
        };

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(createModalContent, {
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
        
        const createModalContent = () => {
            const modalContent = this.createElement('div', { className: 'quickllm-modal-content' });
            
            // Header
            const header = this.createElement('div', { className: 'quickllm-modal-header' });
            const title = this.createElement('h3', {
                className: 'quickllm-modal-title',
                textContent: 'Error'
            });
            const closeBtn = this.createElement('button', {
                className: 'quickllm-close-btn',
                textContent: '×'
            });
            header.appendChild(title);
            header.appendChild(closeBtn);
            
            // Error message
            const errorDiv = this.createElement('div', {
                textContent: message,
                style: {
                    color: '#dc3545',
                    padding: '16px'
                }
            });
            
            // Close button
            const buttonContainer = this.createElement('div', {
                style: { marginTop: '16px' }
            });
            
            const closeErrorBtn = this.createElement('button', {
                className: 'quickllm-btn quickllm-btn-secondary',
                id: 'quickllm-close-error',
                textContent: 'Close'
            });
            
            buttonContainer.appendChild(closeErrorBtn);
            
            modalContent.appendChild(header);
            modalContent.appendChild(errorDiv);
            modalContent.appendChild(buttonContainer);
            
            return modalContent;
        };

        // Create shadow modal
        this.currentModal = new ShadowModal();
        const { shadowRoot, modal } = await this.currentModal.create(createModalContent, {
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