// Shadow DOM Modal utility for QuickLLM extension
import { escapeHtml, prefersDarkMode } from './utils.js';
import shadowModalStyles from '../styles/shadow-modal.css';

class ShadowModal {
    constructor() {
        this.shadowHost = null;
        this.shadowRoot = null;
        this.keydownHandler = null;
        this.hotkeyBlocker = null;
        this.cssContent = null;
    }

    /**
     * Load CSS content for Shadow DOM
     */
    async loadCSS() {
        if (this.cssContent) return this.cssContent;
        
        // Use the imported CSS string from webpack
        this.cssContent = shadowModalStyles;
        return this.cssContent;
    }

    /**
     * Create a modal with Shadow DOM isolation
     * @param {string} content - HTML content for the modal
     * @param {Object} options - Modal options
     * @returns {Object} - Shadow root and modal element references
     */
    async create(content, options = {}) {
        const {
            className = 'quickllm-modal',
            darkTheme = await prefersDarkMode(),
            onClose = null
        } = options;

        // Create shadow host element
        this.shadowHost = document.createElement('div');
        this.shadowHost.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 10000 !important;
            pointer-events: none !important;
        `;

        // Create shadow root
        this.shadowRoot = this.shadowHost.attachShadow({ mode: 'closed' });

        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.className = darkTheme ? `${className} quickllm-dark-theme` : className;
        modalContainer.innerHTML = content;
        
        // Ensure modal container can receive pointer events
        modalContainer.style.pointerEvents = 'auto';

        // Load and add styles to shadow root
        const cssContent = await this.loadCSS();
        const styleElement = document.createElement('style');
        styleElement.textContent = cssContent;
        
        this.shadowRoot.appendChild(styleElement);
        this.shadowRoot.appendChild(modalContainer);

        // Add to document
        document.body.appendChild(this.shadowHost);

        // Setup close handlers
        this.setupCloseHandlers(modalContainer, onClose);

        // Setup hotkey blocking
        this.setupHotkeyBlocking();

        // Setup event isolation within shadow DOM
        this.setupEventIsolation();

        return {
            shadowRoot: this.shadowRoot,
            modal: modalContainer,
            host: this.shadowHost
        };
    }

    /**
     * Setup close button and escape key handlers
     */
    setupCloseHandlers(modalContainer, onClose) {
        // Close button handler
        const closeBtn = modalContainer.querySelector('.quickllm-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (onClose) onClose();
                this.destroy();
            });
        }

        // Escape key handler
        this.keydownHandler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (onClose) onClose();
                this.destroy();
            }
        };

        document.addEventListener('keydown', this.keydownHandler);
    }

    /**
     * Setup hotkey blocking by temporarily disabling the document body
     * This prevents host page hotkeys from firing while modal is active
     */
    setupHotkeyBlocking() {
        // Store original tabindex and set body to not focusable
        this.originalBodyTabIndex = document.body.tabIndex;
        document.body.tabIndex = -1;
        
        // Store original pointer events style specifically
        this.originalPointerEvents = document.body.style.pointerEvents;
        document.body.style.pointerEvents = 'none';
    }

    /**
     * Remove hotkey blocking by restoring document body
     */
    removeHotkeyBlocking() {
        // Restore original pointer events style
        if (this.originalPointerEvents !== undefined) {
            document.body.style.pointerEvents = this.originalPointerEvents;
        } else {
            // If there was no original style, remove the property entirely
            document.body.style.removeProperty('pointer-events');
        }
        
        // Restore original tab index
        if (this.originalBodyTabIndex !== undefined) {
            document.body.tabIndex = this.originalBodyTabIndex;
        } else {
            // Remove tabIndex attribute if it wasn't originally set
            document.body.removeAttribute('tabindex');
        }
    }

    /**
     * Setup event isolation within the shadow DOM
     */
    setupEventIsolation() {
        if (!this.shadowRoot) return;

        // Add event listeners to all input elements within shadow DOM
        const inputs = this.shadowRoot.querySelectorAll('input, textarea, select, button');
        inputs.forEach(input => {
            // Prevent events from bubbling out of shadow DOM
            input.addEventListener('keydown', (e) => {
                e.stopPropagation();
            });
            input.addEventListener('keyup', (e) => {
                e.stopPropagation();
            });
            input.addEventListener('keypress', (e) => {
                e.stopPropagation();
            });
        });

        // Also add a general event listener to the shadow root to catch any events
        this.shadowRoot.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        this.shadowRoot.addEventListener('keyup', (e) => {
            e.stopPropagation();
        });
        this.shadowRoot.addEventListener('keypress', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * Destroy the modal and clean up
     */
    destroy() {
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
            this.keydownHandler = null;
        }

        // Remove hotkey blocking
        this.removeHotkeyBlocking();

        if (this.shadowHost && this.shadowHost.parentNode) {
            this.shadowHost.parentNode.removeChild(this.shadowHost);
        }

        this.shadowHost = null;
        this.shadowRoot = null;
    }

    /**
     * Query selector within the shadow DOM
     * @param {string} selector - CSS selector
     * @returns {Element|null} - Found element or null
     */
    querySelector(selector) {
        if (!this.shadowRoot) return null;
        return this.shadowRoot.querySelector(selector);
    }

    /**
     * Query all selectors within the shadow DOM
     * @param {string} selector - CSS selector
     * @returns {NodeList} - Found elements
     */
    querySelectorAll(selector) {
        if (!this.shadowRoot) return [];
        return this.shadowRoot.querySelectorAll(selector);
    }

    /**
     * Add event listener to an element within the shadow DOM
     * @param {string} selector - CSS selector
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     */
    addEventListener(selector, event, handler) {
        const element = this.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    }
}

export default ShadowModal;