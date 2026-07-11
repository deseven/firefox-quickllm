// Diff renderer utility for showing changes between input and output text
import { diffWordsWithSpace } from 'diff';
import { escapeHtml } from './dom-utils.js';

class DiffRenderer {
    /**
     * Render a diff between the original input text and the AI output text
     * as HTML with <del> and <ins> tags highlighting changes.
     * @param {string} originalText - The original input text
     * @param {string} newText - The new (AI-generated) text
     * @returns {string} HTML string with highlighted changes
     */
    render(originalText, newText) {
        if (!originalText || !newText) {
            return escapeHtml(newText || '');
        }

        try {
            const changes = diffWordsWithSpace(originalText, newText);
            let html = '';

            changes.forEach((part) => {
                const escaped = escapeHtml(part.value);
                if (part.added) {
                    html += `<ins class="quickllm-diff-ins">${escaped}</ins>`;
                } else if (part.removed) {
                    html += `<del class="quickllm-diff-del">${escaped}</del>`;
                } else {
                    html += escaped;
                }
            });

            return html;
        } catch (error) {
            console.error('Diff rendering failed:', error);
            // Fallback to escaped plain text
            return escapeHtml(newText);
        }
    }

    /**
     * Render a diff between the original input text and the AI output text
     * into a target DOM element.
     * @param {string} originalText - The original input text
     * @param {string} newText - The new (AI-generated) text
     * @param {HTMLElement} targetElement - Target element to render into
     */
    renderToElement(originalText, newText, targetElement) {
        if (!targetElement) return;

        // Clear existing content
        while (targetElement.firstChild) {
            targetElement.removeChild(targetElement.firstChild);
        }

        const html = this.render(originalText, newText);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const bodyChildren = Array.from(doc.body.childNodes);
        bodyChildren.forEach(child => {
            targetElement.appendChild(child);
        });

        targetElement.classList.add('diff-content');
        targetElement.classList.remove('markdown-content');
    }
}

// Create a singleton instance
const diffRenderer = new DiffRenderer();

export default diffRenderer;
export { DiffRenderer };
