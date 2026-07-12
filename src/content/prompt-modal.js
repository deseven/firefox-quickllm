// Prompt modal for the content script.
//
// Renders the main processing modal (text preview, system/user prompts,
// response area) inside a ShadowModal and wires up the keyboard shortcuts.
//
// The Enter-key decision logic is extracted into a pure function
// (resolveEnterAction) so it can be unit-tested without a DOM.

import { createElement } from '../utils/dom-utils.js';
import { prefersDarkMode } from '../utils/theme-utils.js';
import ShadowModal from '../utils/shadow-modal.js';

/**
 * @typedef {import('./types.js').Profile} Profile
 */

/**
 * Decide what the Enter key should do inside the prompt modal.
 *
 * When a response is available, the copy button is visible, at least one
 * process has run, and the prompt hasn't changed since the last process,
 * Enter copies the response and closes. Otherwise Enter triggers a new
 * processing request.
 *
 * @param {boolean} hasResponse - Whether a response is currently displayed.
 * @param {boolean} hasProcessedOnce - Whether at least one process has run.
 * @param {string} currentPrompt - The trimmed current prompt value.
 * @param {string} originalPrompt - The trimmed prompt value from the last process.
 * @param {boolean} copyVisible - Whether the copy button is currently visible.
 * @returns {'copy'|'process'} The action to take.
 */
export function resolveEnterAction(hasResponse, hasProcessedOnce, currentPrompt, originalPrompt, copyVisible) {
    if (copyVisible && hasResponse && hasProcessedOnce && currentPrompt === originalPrompt) {
        return 'copy';
    }
    return 'process';
}

/**
 * Build the prompt modal content element.
 *
 * @param {Object} params
 * @param {string} params.text - The text to process.
 * @param {string} params.textType - How the text was obtained (for the title).
 * @param {Profile} params.profile - The selected profile.
 * @param {boolean} params.prefersDark - Whether dark theme is active.
 * @returns {HTMLElement} The modal content root element.
 */
export function buildPromptModalContent({ text, textType, profile, prefersDark }) {
    const modalContent = createElement('div', { className: 'quickllm-modal-content' });

    // Header
    const header = createElement('div', { className: 'quickllm-modal-header' });
    const title = createElement('h3', {
        className: 'quickllm-modal-title',
        textContent: `Process ${textType} - ${profile.name} (${profile.type})`
    });
    const closeBtn = createElement('button', {
        className: 'quickllm-close-btn',
        textContent: '×'
    });
    header.appendChild(title);
    header.appendChild(closeBtn);

    // Body
    const body = createElement('div', { className: 'quickllm-modal-body' });

    // Left side
    const leftSide = createElement('div', { className: 'quickllm-modal-left' });

    // Text to process
    const textGroup = createElement('div', { className: 'quickllm-form-group' });
    const textLabel = createElement('label', {
        className: 'quickllm-label',
        textContent: 'Text to process:'
    });
    const textPreview = createElement('div', {
        className: 'quickllm-text-preview',
        textContent: text
    });
    textGroup.appendChild(textLabel);
    textGroup.appendChild(textPreview);

    // System prompt
    const systemGroup = createElement('div', { className: 'quickllm-form-group' });
    const systemLabel = createElement('label', {
        className: 'quickllm-label',
        textContent: 'System Prompt:'
    });
    const systemInput = createElement('input', {
        className: 'quickllm-input',
        id: 'quickllm-system-prompt',
        attributes: {
            type: 'text',
            readonly: true,
            value: profile.systemPrompt || 'No system prompt configured'
        },
        style: { cursor: 'default' }
    });
    systemGroup.appendChild(systemLabel);
    systemGroup.appendChild(systemInput);

    // User prompt
    const userGroup = createElement('div', { className: 'quickllm-form-group' });
    const userLabel = createElement('label', {
        className: 'quickllm-label',
        textContent: 'User Prompt:'
    });
    const userTextarea = createElement('textarea', {
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
    const infoGroup = createElement('div', { className: 'quickllm-form-group' });
    const infoDiv = createElement('div', { className: 'quickllm-shortcuts-info' });

    const shortcutsInfo = createElement('strong', { textContent: 'Keyboard shortcuts:' });
    const br = document.createElement('br');
    const shortcuts = createElement('span');
    shortcuts.appendChild(document.createTextNode('• Enter: Process (one time per unique prompt)'));
    shortcuts.appendChild(document.createElement('br'));
    shortcuts.appendChild(document.createTextNode('• Shift+Enter: New line in prompt'));
    shortcuts.appendChild(document.createElement('br'));
    shortcuts.appendChild(document.createTextNode('• Enter again after response: Copy & Close'));
    shortcuts.appendChild(document.createElement('br'));
    shortcuts.appendChild(document.createTextNode('• Escape: Close'));

    infoDiv.appendChild(shortcutsInfo);
    infoDiv.appendChild(br);
    infoDiv.appendChild(shortcuts);
    infoGroup.appendChild(infoDiv);

    leftSide.appendChild(textGroup);
    leftSide.appendChild(systemGroup);
    leftSide.appendChild(userGroup);
    leftSide.appendChild(infoGroup);

    // Right side
    const rightSide = createElement('div', { className: 'quickllm-modal-right' });
    const responseContainer = createElement('div', {
        className: 'quickllm-response-container',
        id: 'quickllm-response-container'
    });
    const responseLabel = createElement('label', {
        className: 'quickllm-label quickllm-response-label',
        textContent: 'AI Response:'
    });
    const responseDiv = createElement('div', {
        className: 'quickllm-response',
        id: 'quickllm-response'
    });
    responseContainer.appendChild(responseLabel);
    responseContainer.appendChild(responseDiv);
    rightSide.appendChild(responseContainer);

    body.appendChild(leftSide);
    body.appendChild(rightSide);

    // Footer
    const footer = createElement('div', { className: 'quickllm-modal-footer' });

    const leftFooter = createElement('div');
    const processBtn = createElement('button', {
        className: 'quickllm-btn',
        id: 'quickllm-process',
        textContent: 'Process'
    });
    leftFooter.appendChild(processBtn);

    const rightFooter = createElement('div');
    const copyBtn = createElement('button', {
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
}

/**
 * Show the prompt modal.
 *
 * @param {Object} params
 * @param {string} params.text - The text to process.
 * @param {string} params.textType - How the text was obtained.
 * @param {Profile} params.profile - The selected profile.
 * @param {() => void} params.onClose - Called when the modal is closed.
 * @param {(userPrompt: string) => Promise<void>} params.onProcess - Called when processing is requested.
 * @param {(copyBtn: HTMLElement) => void} params.onCopy - Called when the copy button is clicked.
 * @returns {Promise<{ modal: ShadowModal, getProcessBtn: () => HTMLElement, getUserPromptInput: () => HTMLElement, getCopyBtn: () => HTMLElement }>}
 */
export async function showPromptModal({ text, textType, profile, onClose, onProcess, onCopy }) {
    const prefersDark = await prefersDarkMode();
    const shouldProcessImmediately = profile.processImmediately;

    const modal = new ShadowModal();
    await modal.create(() => buildPromptModalContent({ text, textType, profile, prefersDark }), {
        darkTheme: prefersDark,
        onClose: () => onClose()
    });

    const processBtn = /** @type {HTMLButtonElement} */ (modal.querySelector('#quickllm-process'));
    const userPromptInput = /** @type {HTMLTextAreaElement} */ (modal.querySelector('#quickllm-user-prompt'));
    const copyBtn = /** @type {HTMLButtonElement} */ (modal.querySelector('#quickllm-copy'));

    // Track prompt state for the Enter-key decision
    let originalPrompt = userPromptInput.value.trim();
    let hasResponse = false;
    let hasProcessedOnce = false;

    const runProcess = async () => {
        originalPrompt = userPromptInput.value.trim();
        hasResponse = false;
        await onProcess(originalPrompt);
        hasResponse = true;
        hasProcessedOnce = true;
    };

    processBtn.addEventListener('click', runProcess);

    // Copy button handler
    copyBtn.addEventListener('click', () => {
        // The response text is read from the response element by the caller
        // via onCopy; here we just trigger the callback.
        onCopy(copyBtn);
    });

    // Keyboard shortcuts — registered via the modal's keyboard isolation
    // layer so that only our hotkeys work while the modal is active and the
    // host page's keyboard handlers are completely blocked. The handler
    // receives events both from inside the Shadow DOM (e.g. typing in the
    // textarea) and from the host page.
    const handleKeyDown = (/** @type {KeyboardEvent} */ e) => {
        if (!modal) return;

        // Enter: Process or Copy & Close (only if prompt unchanged).
        // Shift+Enter is left alone so it inserts a newline in the textarea.
        if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            const currentPrompt = userPromptInput.value.trim();
            const action = resolveEnterAction(
                hasResponse,
                hasProcessedOnce,
                currentPrompt,
                originalPrompt,
                copyBtn.style.display !== 'none'
            );
            if (action === 'copy') {
                copyBtn.click();
            } else {
                processBtn.click();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
        // All other keys (including Shift+Enter for newlines, regular
        // typing, arrow navigation within the textarea, etc.) are allowed
        // to proceed — the isolation layer ensures they never reach the
        // host page's listeners.
    };

    modal.setKeyHandler(handleKeyDown);

    // Always focus on user prompt input and select all text
    setTimeout(() => {
        userPromptInput.focus();
        userPromptInput.select();
    }, 100);

    // If should process immediately, do it now
    if (shouldProcessImmediately) {
        setTimeout(async () => {
            await runProcess();
        }, 100);
    }

    return {
        modal,
        getProcessBtn: () => processBtn,
        getUserPromptInput: () => userPromptInput,
        getCopyBtn: () => copyBtn
    };
}
