/**
 * @vitest-environment jsdom
 */
// Tests for ShadowModal keyboard isolation.
//
// These tests verify that while a modal is active:
//   - Keyboard events originating from the host page are routed to our key
//     handler and blocked from reaching the page's own listeners.
//   - Keyboard events originating from inside the Shadow DOM are routed to
//     our key handler but still reach the target element (typing works).
//   - After destroy(), all listeners are removed and the page's keyboard
//     functionality is fully restored.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ShadowModal from './shadow-modal.js';

// Stub the CSS import — esbuild inlines it, but under vitest we need a mock.
vi.mock('../styles/shadow-modal.css', () => ({ default: '' }));

// prefersDarkMode is async; stub it to avoid storage access in jsdom.
vi.mock('./theme-utils.js', () => ({
    prefersDarkMode: vi.fn().mockResolvedValue(false),
}));

// escapeHtml is imported by shadow-modal.js but not used in these tests.
vi.mock('./dom-utils.js', () => ({
    escapeHtml: vi.fn((s) => s),
}));

/**
 * Dispatch a keyboard event on a given target and return whether the page
 * (document-level) listener saw it.
 * @param {EventTarget} target
 * @param {string} type
 * @param {Object} [init]
 * @returns {boolean} true if the document listener received the event.
 */
function dispatchKey(target, type, init = {}) {
    let pageSawIt = false;
    const docListener = () => { pageSawIt = true; };
    document.addEventListener(type, docListener);
    const event = new KeyboardEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        key: 'a',
        ...init,
    });
    target.dispatchEvent(event);
    document.removeEventListener(type, docListener);
    return pageSawIt;
}

describe('ShadowModal keyboard isolation', () => {
    /** @type {ShadowModal} */
    let modal;
    /** @type {any} */
    let keyHandler;
    /** @type {HTMLElement} */
    let pageInput;

    beforeEach(() => {
        // A host-page input that simulates the page's focusable element.
        pageInput = document.createElement('input');
        document.body.appendChild(pageInput);

        keyHandler = vi.fn();
    });

    afterEach(() => {
        if (modal) {
            modal.destroy();
            modal = /** @type {any} */ (null);
        }
        if (pageInput && pageInput.parentNode) {
            pageInput.parentNode.removeChild(pageInput);
        }
        document.body.innerHTML = '';
    });

    async function createModal() {
        modal = new ShadowModal();
        await modal.create(() => {
            const content = document.createElement('div');
            const textarea = document.createElement('textarea');
            textarea.id = 'test-textarea';
            content.appendChild(textarea);
            return content;
        }, { onClose: () => {} });
        modal.setKeyHandler(keyHandler);
        return modal;
    }

    it('routes host-page keydown events to the key handler and blocks them from the page', async () => {
        await createModal();

        const pageSawIt = dispatchKey(pageInput, 'keydown', { key: 'ArrowDown' });

        expect(keyHandler).toHaveBeenCalledTimes(1);
        expect(keyHandler.mock.calls[0][0].key).toBe('ArrowDown');
        // The page's document-level listener must NOT see the event.
        expect(pageSawIt).toBe(false);
    });

    it('blocks host-page keyup events from the page (not routed to key handler)', async () => {
        await createModal();

        const pageSawIt = dispatchKey(pageInput, 'keyup', { key: 'Escape' });

        // keyup is blocked from the page but not routed to the key handler
        // (only keydown is routed, matching the original behaviour).
        expect(keyHandler).not.toHaveBeenCalled();
        expect(pageSawIt).toBe(false);
    });

    it('blocks host-page keypress events from the page (not routed to key handler)', async () => {
        await createModal();

        const pageSawIt = dispatchKey(pageInput, 'keypress', { key: 'Enter' });

        // keypress is blocked from the page but not routed to the key handler
        // (only keydown is routed, matching the original behaviour).
        expect(keyHandler).not.toHaveBeenCalled();
        expect(pageSawIt).toBe(false);
    });

    it('routes a single keydown to the handler (not keyup/keypress)', async () => {
        // Regression test: an arrow press must only move the selection once.
        // Previously all three event types were routed, causing double moves.
        await createModal();

        dispatchKey(pageInput, 'keydown', { key: 'ArrowDown' });
        dispatchKey(pageInput, 'keyup', { key: 'ArrowDown' });
        dispatchKey(pageInput, 'keypress', { key: 'ArrowDown' });

        expect(keyHandler).toHaveBeenCalledTimes(1);
        expect(keyHandler.mock.calls[0][0].key).toBe('ArrowDown');
    });

    it('routes Shadow-DOM keydown events to the key handler', async () => {
        await createModal();
        const textarea = /** @type {HTMLElement} */ (modal.querySelector('#test-textarea'));

        // Events from inside the shadow DOM should reach our handler.
        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            composed: true,
            key: 'Enter',
        });
        textarea.dispatchEvent(event);

        expect(keyHandler).toHaveBeenCalledTimes(1);
        expect(keyHandler.mock.calls[0][0].key).toBe('Enter');
    });

    it('blocks Shadow-DOM keydown events from bubbling to the page document', async () => {
        await createModal();
        const textarea = /** @type {HTMLElement} */ (modal.querySelector('#test-textarea'));

        let pageSawIt = false;
        const docListener = () => { pageSawIt = true; };
        document.addEventListener('keydown', docListener);

        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            composed: true,
            key: 'Enter',
        });
        textarea.dispatchEvent(event);

        document.removeEventListener('keydown', docListener);
        expect(pageSawIt).toBe(false);
    });

    it('restores page keyboard functionality after destroy()', async () => {
        await createModal();
        modal.destroy();
        modal = /** @type {any} */ (null);

        // After destroy, host-page events should reach the page again.
        const pageSawIt = dispatchKey(pageInput, 'keydown', { key: 'ArrowDown' });

        expect(keyHandler).not.toHaveBeenCalled();
        expect(pageSawIt).toBe(true);
    });

    it('restores pointer events on body after destroy()', async () => {
        const original = document.body.style.pointerEvents;
        await createModal();
        // While modal is active, body pointer events are disabled.
        expect(document.body.style.pointerEvents).toBe('none');

        modal.destroy();
        modal = /** @type {any} */ (null);

        // After destroy, the original value is restored.
        expect(document.body.style.pointerEvents).toBe(original);
    });

    it('uses the default Escape handler when no custom key handler is set', async () => {
        const onClose = vi.fn();
        modal = new ShadowModal();
        await modal.create(() => document.createElement('div'), { onClose });
        // No setKeyHandler call — the default handler only handles Escape.

        // A non-Escape key from the page should be blocked but not call onClose.
        dispatchKey(pageInput, 'keydown', { key: 'a' });
        expect(onClose).not.toHaveBeenCalled();

        // Escape should trigger onClose.
        dispatchKey(pageInput, 'keydown', { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('setKeyHandler(null) disables custom handling and falls back to default', async () => {
        await createModal();
        // Replace with null — no custom handler.
        modal.setKeyHandler(null);

        dispatchKey(pageInput, 'keydown', { key: 'ArrowDown' });
        // The custom handler should not be called.
        expect(keyHandler).not.toHaveBeenCalled();
    });
});
