// Shadow DOM Modal utility for QuickLLM extension
import { escapeHtml } from './dom-utils.js';
import { prefersDarkMode } from './theme-utils.js';
import shadowModalStyles from '../styles/shadow-modal.css';

class ShadowModal {
    constructor() {
        this.shadowHost = null;
        this.shadowRoot = null;
        /** @type {((e: KeyboardEvent) => void)|null} */
        this.keyHandler = null;
        this.cssContent = null;
        /** @type {EventListener|null} */
        this.windowCaptureHandler = null;
        /** @type {EventListener|null} */
        this.shadowHostBubbleHandler = null;
        this.originalPointerEvents = undefined;
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
     * @param {Element|Function} content - DOM element or function that creates DOM elements for the modal
     * @param {Object<string, any>} [options] - Modal options
     * @returns {Promise<Object>} - Shadow root and modal element references
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
        
        // Handle content - either DOM element or function that creates DOM elements
        if (typeof content === 'function') {
            const contentElement = content();
            modalContainer.appendChild(contentElement);
        } else if (content instanceof Element) {
            modalContainer.appendChild(content);
        } else {
            throw new Error('Content must be a DOM element or a function that returns a DOM element');
        }
        
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

        // Setup close handlers (registers default Escape key handler)
        this.setupCloseHandlers(modalContainer, onClose);

        // Setup mouse blocking (prevents interaction with page behind modal)
        this.setupMouseBlocking();

        // Setup keyboard isolation (intercepts all keyboard events so only
        // our hotkeys work while the modal is active)
        this.setupKeyboardIsolation();

        return {
            shadowRoot: this.shadowRoot,
            modal: modalContainer,
            host: this.shadowHost
        };
    }

    /**
     * Setup close button and escape key handlers
     * @param {HTMLElement} modalContainer
     * @param {(() => void)|null} [onClose]
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

        // Default key handler: Escape to close. This can be overridden
        // via setKeyHandler() for modals that need more complex handling.
        this.keyHandler = (/** @type {KeyboardEvent} */ e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (onClose) onClose();
                this.destroy();
            }
        };
    }

    /**
     * Setup mouse blocking by disabling pointer events on the document body.
     * This prevents the user from interacting with the page behind the modal.
     */
    setupMouseBlocking() {
        this.originalPointerEvents = document.body.style.pointerEvents;
        document.body.style.pointerEvents = 'none';
    }

    /**
     * Remove mouse blocking by restoring the document body's pointer events.
     */
    removeMouseBlocking() {
        if (this.originalPointerEvents !== undefined) {
            document.body.style.pointerEvents = this.originalPointerEvents;
        } else {
            document.body.style.removeProperty('pointer-events');
        }
    }

    /**
     * Setup keyboard isolation so that only our hotkeys work while the modal
     * is active, and the host page's keyboard handlers are completely blocked.
     *
     * This uses two layers:
     *
     * 1. A **capture-phase** listener on `window` that intercepts every
     *    keyboard event before it reaches the page's own listeners. Events
     *    that originate from outside our Shadow DOM (i.e. from the host page)
     *    are routed to our key handler and then cancelled — the page never
     *    sees them.
     *
     * 2. A **bubble-phase** listener on the shadow host that catches events
     *    originating inside the Shadow DOM (after they've been handled by the
     *    target element, e.g. a textarea), routes them to our key handler,
     *    and stops them from bubbling out to the host page's document/window
     *    listeners.
     *
     * Together these guarantee that:
     *   - Page hotkeys (arrows, Enter, Escape, etc.) do NOT fire while the
     *     modal is open.
     *   - Our own hotkeys DO fire.
     *   - Regular typing inside the modal's textarea/inputs still works.
     *   - When the modal is destroyed, all listeners are removed and the
     *     page's keyboard functionality is fully restored.
     */
    setupKeyboardIsolation() {
        const keyboardEvents = /** @type {any[]} */ (['keydown', 'keyup', 'keypress']);

        // 1. Window capture-phase listener — the outermost gatekeeper.
        this.windowCaptureHandler = /** @type {EventListener} */ ((e) => {
            if (!this.shadowHost || !this.shadowHost.isConnected) return;

            const fromOurModal = e.composedPath().includes(this.shadowHost);

            if (!fromOurModal) {
                // Event originated from the host page, not our modal.
                // Route only 'keydown' to our handler (matching the original
                // behaviour where only keydown was listened to), then block
                // all keyboard event types so the page's own listeners never
                // see them.
                if (e.type === 'keydown' && this.keyHandler) {
                    this.keyHandler(/** @type {KeyboardEvent} */ (e));
                }
                e.stopImmediatePropagation();
                e.preventDefault();
            }
            // If the event came from inside our Shadow DOM, let it pass
            // through to the target element (textarea, input, etc.) so that
            // normal typing works. The shadowHost bubble handler below will
            // route it to our key handler and stop it from leaking out.
        });

        // 2. Shadow host bubble-phase listener — catches events that
        //    originated inside the Shadow DOM after they've been handled by
        //    the target element.
        this.shadowHostBubbleHandler = /** @type {EventListener} */ ((e) => {
            // Route only 'keydown' to our handler so that a single key press
            // doesn't trigger the handler multiple times (keydown + keyup +
            // keypress).
            if (e.type === 'keydown' && this.keyHandler) {
                this.keyHandler(/** @type {KeyboardEvent} */ (e));
            }
            // Stop the event from bubbling out to the host page's
            // document/window listeners.
            e.stopImmediatePropagation();
        });

        const captureHandler = this.windowCaptureHandler;
        const bubbleHandler = this.shadowHostBubbleHandler;
        const host = this.shadowHost;
        keyboardEvents.forEach(evt => {
            if (captureHandler) {
                window.addEventListener(evt, captureHandler, true);
            }
            if (host && bubbleHandler) {
                host.addEventListener(evt, bubbleHandler, false);
            }
        });
    }

    /**
     * Remove keyboard isolation listeners, restoring the page's keyboard
     * functionality.
     */
    removeKeyboardIsolation() {
        const keyboardEvents = /** @type {any[]} */ (['keydown', 'keyup', 'keypress']);

        if (this.windowCaptureHandler) {
            const handler = this.windowCaptureHandler;
            keyboardEvents.forEach(evt => {
                window.removeEventListener(evt, handler, true);
            });
            this.windowCaptureHandler = null;
        }

        if (this.shadowHostBubbleHandler && this.shadowHost) {
            const handler = this.shadowHostBubbleHandler;
            const host = this.shadowHost;
            keyboardEvents.forEach(evt => {
                host.removeEventListener(evt, handler, false);
            });
            this.shadowHostBubbleHandler = null;
        }
    }

    /**
     * Set the keyboard event handler for this modal.
     *
     * The handler receives every keyboard event that is intercepted while the
     * modal is active (both from inside the Shadow DOM and from the host page).
     * Call `e.preventDefault()` for keys you want to fully handle (e.g. Enter,
     * Escape, arrow keys); otherwise the default action (e.g. typing in a
     * textarea) is allowed to proceed.
     *
     * @param {((e: KeyboardEvent) => void)|null} handler
     */
    setKeyHandler(handler) {
        this.keyHandler = handler;
    }

    /**
     * Destroy the modal and clean up
     */
    destroy() {
        // Remove keyboard isolation listeners first so no more events fire
        // while we're tearing down.
        this.removeKeyboardIsolation();

        // Remove mouse blocking
        this.removeMouseBlocking();

        if (this.shadowHost && this.shadowHost.parentNode) {
            this.shadowHost.parentNode.removeChild(this.shadowHost);
        }

        this.shadowHost = null;
        this.shadowRoot = null;
        this.keyHandler = null;
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
        if (!this.shadowRoot) return /** @type {any} */ ([]);
        return this.shadowRoot.querySelectorAll(selector);
    }

    /**
     * Add event listener to an element within the shadow DOM
     * @param {string} selector - CSS selector
     * @param {string} event - Event type
     * @param {EventListener} handler - Event handler
     */
    addEventListener(selector, event, handler) {
        const element = this.querySelector(selector);
        if (element) {
            element.addEventListener(event, handler);
        }
    }
}

export default ShadowModal;