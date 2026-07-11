// Text extraction for the content script.
//
// Responsible for two concerns:
//   1. Reading the user's current text selection.
//   2. Extracting the main page content as Markdown (via Turndown),
//      stripping navigation, ads, media, and other noise.
//
// Extracted from the monolithic ContentManager so the extraction logic
// can be tested and reused independently of the modal UI.

import TurndownService from 'turndown';

/**
 * Selectors that commonly wrap the main readable content of a page.
 * Checked in priority order; the first match wins.
 * @type {string[]}
 */
const CONTENT_SELECTORS = [
    'main', 'article', '[role="main"]', '.content', '#content',
    '.post', '.entry', '.article-body', '.story-body'
];

/**
 * Elements that should be removed from the cloned content before conversion.
 * These are typically non-content: scripts, styles, navigation, ads, etc.
 * @type {string[]}
 */
const UNWANTED_SELECTORS = [
    'script', 'style', 'noscript', 'iframe', 'object', 'embed',
    'nav', 'header', 'footer', 'aside', '.sidebar', '.navigation',
    '.menu', '.ads', '.advertisement', '.social', '.share',
    '.comments', '.comment', '.related', '.recommended'
];

/**
 * Minimum length of the original diff text before streaming diff updates
 * are throttled to one render per animation frame.
 * @type {number}
 */
export const DIFF_THROTTLE_THRESHOLD = 10000;

/**
 * Lazily-created Turndown service instance. Configured once and reused
 * across calls to avoid re-initializing the rule set on every extraction.
 * @type {any|null}
 */
let turndownService = null;

/**
 * Create and configure the Turndown service.
 * @returns {any}
 */
function createTurndownService() {
    // Cast to `any` because the turndown package's type definitions report
    // addRule()/turndown() as "not callable" (TS2349) under the current
    // jsconfig (no esModuleInterop), since turndown uses a CommonJS `export =`.
    const service = /** @type {any} */ (new TurndownService({
        headingStyle: 'atx',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
        fence: '```',
        emDelimiter: '*',
        strongDelimiter: '**',
        linkStyle: 'inlined'
    }));

    // Remove media elements completely — they add noise to the prompt.
    service.addRule('removeMedia', {
        filter: function (/** @type {Node} */ node) {
            return node.nodeName === 'IMG' ||
                   node.nodeName === 'VIDEO' ||
                   node.nodeName === 'AUDIO' ||
                   node.nodeName === 'SVG';
        },
        replacement: function () {
            return '';
        }
    });

    return service;
}

/**
 * Get the shared Turndown service instance, creating it on first use.
 * @returns {any}
 */
function getTurndownService() {
    if (!turndownService) {
        turndownService = createTurndownService();
    }
    return turndownService;
}

/**
 * Reset the cached Turndown service. Intended for testing.
 */
export function _resetTurndownService() {
    turndownService = null;
}

/**
 * Get the user's current text selection, trimmed.
 * @returns {string} The selected text, or an empty string if nothing is selected.
 */
export function getSelectedText() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
}

/**
 * Find the main content element on the page.
 * Checks a list of common content selectors, falling back to document.body.
 * @param {Document} [doc=document] - The document to search (injectable for testing).
 * @returns {Element} The main content element, or document.body as a fallback.
 */
export function findMainContentElement(doc = document) {
    for (const selector of CONTENT_SELECTORS) {
        const element = doc.querySelector(selector);
        if (element) {
            return element;
        }
    }
    return doc.body || null;
}

/**
 * Remove unwanted child elements (scripts, nav, ads, etc.) from a cloned node.
 * @param {HTMLElement} element - The cloned element to clean (mutated in place).
 */
export function removeUnwantedElements(element) {
    UNWANTED_SELECTORS.forEach(selector => {
        const elements = element.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    });
}

/**
 * Clean up extracted Markdown: collapse excessive whitespace while
 * preserving meaningful line breaks.
 * @param {string} markdown - The raw Markdown from Turndown.
 * @returns {string} Cleaned Markdown.
 */
export function cleanMarkdown(markdown) {
    return markdown
        .replace(/\n{4,}/g, '\n\n\n')   // Limit consecutive newlines to max 3
        .replace(/[ \t]+/g, ' ')        // Collapse runs of spaces/tabs
        .replace(/[ \t]*\n[ \t]*/g, '\n') // Strip spaces around newlines
        .trim();
}

/**
 * Convert an HTML element to Markdown using the shared Turndown service.
 * @param {HTMLElement} element - The element to convert.
 * @returns {string} Markdown representation of the element's content.
 */
export function convertElementToMarkdown(element) {
    const service = getTurndownService();
    return service.turndown(element);
}

/**
 * Extract the page's main content as Markdown.
 *
 * Locates the main content element, clones it, strips unwanted noise
 * (scripts, navigation, ads, media), and converts the remainder to
 * Markdown via Turndown. Returns an empty string if no content is found.
 *
 * @param {Document} [doc=document] - The document to extract from (injectable for testing).
 * @returns {string} The page content as cleaned Markdown.
 */
export function getPageText(doc = document) {
    const element = findMainContentElement(doc);
    if (!element) {
        return '';
    }

    // Clone so the original DOM is never modified.
    const clonedElement = /** @type {HTMLElement} */ (element.cloneNode(true));
    removeUnwantedElements(clonedElement);

    const markdown = convertElementToMarkdown(clonedElement);
    return cleanMarkdown(markdown);
}

/**
 * Extract text from the page, preferring the user's selection.
 *
 * If there is a non-empty selection, it is returned as "selected text".
 * Otherwise the page content is extracted as "page content".
 *
 * @param {Document} [doc=document] - The document to extract from (injectable for testing).
 * @returns {import('./types.js').ExtractedText} The extracted text and how it was obtained.
 */
export function extractText(doc = document) {
    const selectedText = getSelectedText();
    if (selectedText) {
        return { text: selectedText, textType: 'selected text' };
    }

    const pageText = getPageText(doc);
    return { text: pageText, textType: 'page content' };
}
