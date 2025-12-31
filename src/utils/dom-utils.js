// DOM manipulation utilities for QuickLLM extension
import markdownRenderer from './markdown-renderer.js';

/**
 * Create DOM elements programmatically with options
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, options = {}) {
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

/**
 * Clear all children from an element using DOM APIs
 * @param {HTMLElement} element - Element to clear
 */
export function clearElement(element) {
    if (!element) return;
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Safely render markdown content to DOM element
 * @param {string} content - Markdown content to render
 * @param {HTMLElement} targetElement - Target element to render into
 */
export function renderMarkdownToElement(content, targetElement) {
    if (!targetElement || !content) return;
    
    // Clear existing content
    clearElement(targetElement);
    
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

/**
 * Create a loading state element
 * @param {string} message - Loading message (default: 'Processing...')
 * @returns {HTMLElement} Loading element
 */
export function createLoadingElement(message = 'Processing...') {
    const loadingDiv = createElement('div', { className: 'quickllm-loading' });
    const spinnerDiv = createElement('div', { className: 'quickllm-spinner' });
    const loadingText = document.createTextNode(message);
    
    loadingDiv.appendChild(spinnerDiv);
    loadingDiv.appendChild(loadingText);
    
    return loadingDiv;
}

/**
 * Create a Bootstrap loading state element
 * @param {string} message - Loading message (default: 'Processing...')
 * @returns {HTMLElement} Bootstrap loading element
 */
export function createBootstrapLoadingElement(message = 'Processing...') {
    const containerDiv = createElement('div', { className: 'text-center py-4' });
    const spinnerDiv = createElement('div', {
        className: 'spinner-border text-primary',
        attributes: { role: 'status' }
    });
    const hiddenSpan = createElement('span', {
        className: 'visually-hidden',
        textContent: 'Loading...'
    });
    const messageP = createElement('p', {
        className: 'text-muted mt-2',
        textContent: message
    });
    
    spinnerDiv.appendChild(hiddenSpan);
    containerDiv.appendChild(spinnerDiv);
    containerDiv.appendChild(messageP);
    
    return containerDiv;
}

/**
 * Show loading state in an element
 * @param {HTMLElement} element - Target element
 * @param {string} message - Loading message
 * @param {boolean} useBootstrap - Whether to use Bootstrap styling
 */
export function showLoadingState(element, message = 'Processing...', useBootstrap = false) {
    if (!element) return;
    
    clearElement(element);
    const loadingElement = useBootstrap 
        ? createBootstrapLoadingElement(message)
        : createLoadingElement(message);
    element.appendChild(loadingElement);
}

/**
 * Create an error element
 * @param {string} message - Error message
 * @param {string} className - CSS class for styling (default: error styling)
 * @returns {HTMLElement} Error element
 */
export function createErrorElement(message, className = null) {
    const errorDiv = createElement('div', {
        textContent: message,
        style: {
            color: '#dc3545',
            padding: '16px'
        }
    });
    
    if (className) {
        errorDiv.className = className;
    }
    
    return errorDiv;
}

/**
 * Show error state in an element
 * @param {HTMLElement} element - Target element
 * @param {string} message - Error message
 * @param {string} className - CSS class for styling
 */
export function showErrorState(element, message, className = null) {
    if (!element) return;
    
    clearElement(element);
    const errorElement = createErrorElement(message, className);
    element.appendChild(errorElement);
}

/**
 * Add event listener with automatic cleanup tracking
 * @param {HTMLElement} element - Element to add listener to
 * @param {string} event - Event type
 * @param {Function} handler - Event handler
 * @param {Array} cleanupArray - Array to track cleanup functions (optional)
 */
export function addEventListenerWithCleanup(element, event, handler, cleanupArray = null) {
    if (!element) return;
    
    element.addEventListener(event, handler);
    
    const cleanup = () => element.removeEventListener(event, handler);
    
    if (cleanupArray && Array.isArray(cleanupArray)) {
        cleanupArray.push(cleanup);
    }
    
    return cleanup;
}

/**
 * Create a button element with common options
 * @param {Object} options - Button options
 * @returns {HTMLElement} Button element
 */
export function createButton(options = {}) {
    const {
        text = '',
        className = 'btn',
        id = null,
        title = null,
        disabled = false,
        icon = null,
        onClick = null
    } = options;
    
    const button = createElement('button', {
        className,
        id,
        textContent: icon ? '' : text,
        attributes: {
            ...(title && { title }),
            ...(disabled && { disabled: 'disabled' })
        }
    });
    
    if (icon) {
        const iconElement = createElement('i', { className: icon });
        button.appendChild(iconElement);
        if (text) {
            button.appendChild(document.createTextNode(` ${text}`));
        }
    }
    
    if (onClick) {
        button.addEventListener('click', onClick);
    }
    
    return button;
}

/**
 * Create a form group with label and input
 * @param {Object} options - Form group options
 * @returns {HTMLElement} Form group element
 */
export function createFormGroup(options = {}) {
    const {
        label = '',
        inputType = 'text',
        inputId = null,
        inputClass = 'form-control',
        inputValue = '',
        inputPlaceholder = '',
        required = false,
        readonly = false
    } = options;
    
    const formGroup = createElement('div', { className: 'mb-3' });
    
    if (label) {
        const labelElement = createElement('label', {
            className: 'form-label',
            textContent: label,
            ...(inputId && { attributes: { for: inputId } })
        });
        formGroup.appendChild(labelElement);
    }
    
    const input = createElement('input', {
        className: inputClass,
        id: inputId,
        attributes: {
            type: inputType,
            value: inputValue,
            ...(inputPlaceholder && { placeholder: inputPlaceholder }),
            ...(required && { required: 'required' }),
            ...(readonly && { readonly: 'readonly' })
        }
    });
    
    formGroup.appendChild(input);
    return formGroup;
}

/**
 * Toggle element visibility with optional animation classes
 * @param {HTMLElement} element - Element to toggle
 * @param {boolean} show - Whether to show or hide
 * @param {string} showClass - Class to add when showing (default: 'd-block')
 * @param {string} hideClass - Class to add when hiding (default: 'd-none')
 */
export function toggleElementVisibility(element, show, showClass = 'd-block', hideClass = 'd-none') {
    if (!element) return;
    
    if (show) {
        element.classList.remove(hideClass);
        element.classList.add(showClass);
    } else {
        element.classList.remove(showClass);
        element.classList.add(hideClass);
    }
}

/**
 * Format endpoint URL for display (extract domain)
 * @param {string} endpoint - Full endpoint URL
 * @returns {string} Formatted endpoint for display
 */
export function formatEndpointForDisplay(endpoint) {
    if (!endpoint) return '';
    try {
        const url = new URL(endpoint);
        return url.hostname;
    } catch (e) {
        // Fallback if URL parsing fails
        return endpoint.replace(/^https?:\/\//, '').split('/')[0];
    }
}

/**
 * Copy text to clipboard with visual feedback
 * @param {string} text - Text to copy
 * @param {HTMLElement} button - Button element to show feedback on (optional)
 * @param {string} successText - Text to show on success (default: 'Copied!')
 * @param {number} feedbackDuration - Duration to show feedback in ms (default: 2000)
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboardWithFeedback(text, button = null, successText = 'Copied!', feedbackDuration = 2000) {
    try {
        await navigator.clipboard.writeText(text);
        
        if (button) {
            const originalText = button.textContent;
            const originalClasses = Array.from(button.classList);
            
            button.textContent = successText;
            button.classList.add('btn-success');
            button.classList.remove('btn-primary');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.className = '';
                originalClasses.forEach(cls => button.classList.add(cls));
            }, feedbackDuration);
        }
        
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        return false;
    }
}