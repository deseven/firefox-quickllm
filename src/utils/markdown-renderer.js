// Markdown renderer utility with GFM support and syntax highlighting
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import { escapeHtml } from './dom-utils.js';

// Import only the most common languages to reduce bundle size
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import rust from 'highlight.js/lib/languages/rust';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';

// Register the languages with all common aliases.
// `registerLang` casts the language module to `any` because highlight.js's
// LanguageFn type and the individual language module return types don't
// structurally match (extra properties like `unicodeRegex`), which trips
// TS2345 under checkJs.
/** @param {string} name @param {any} lang */
const registerLang = (name, lang) => hljs.registerLanguage(name, lang);

registerLang('javascript', javascript);
registerLang('js', javascript);
registerLang('jsx', javascript);
registerLang('python', python);
registerLang('py', python);
registerLang('bash', bash);
registerLang('shell', bash);
registerLang('sh', bash);
registerLang('zsh', bash);
registerLang('rust', rust);
registerLang('rs', rust);
registerLang('go', go);
registerLang('golang', go);
registerLang('java', java);
registerLang('cpp', cpp);
registerLang('c++', cpp);
registerLang('c', cpp);
registerLang('typescript', typescript);
registerLang('ts', typescript);
registerLang('tsx', typescript);
registerLang('json', json);
registerLang('xml', xml);
registerLang('html', xml);
registerLang('xhtml', xml);
registerLang('svg', xml);

class MarkdownRenderer {
    constructor() {
        this.setupMarked();
    }

    setupMarked() {
        // Configure marked with GFM (GitHub Flavored Markdown) support
        marked.use({
            gfm: true,
            breaks: true
        });
    }

    /**
     * Render markdown text to HTML
     * @param {string} markdown - The markdown text to render
     * @returns {string} - The rendered HTML
     */
    render(markdown) {
        if (!markdown || typeof markdown !== 'string') {
            return '';
        }

        try {
            // marked.parse() is typed as returning `string | Promise<string>`,
            // but with the synchronous configuration above it always returns
            // a string. Cast to string so the post-processing helpers type-check.
            let html = /** @type {string} */ (marked.parse(markdown));

            // Post-process the HTML to add our custom classes
            html = this.postProcessHtml(html);

            // Apply syntax highlighting to code blocks
            html = this.applySyntaxHighlighting(html);

            return html;
        } catch (error) {
            console.error('Markdown rendering failed:', error);
            // Fallback to escaped plain text
            return escapeHtml(markdown).replace(/\n/g, '<br>');
        }
    }

    /**
     * Apply syntax highlighting to code blocks
     * @param {string} html - The HTML to process
     * @returns {string} - The processed HTML with highlighting
     */
    applySyntaxHighlighting(html) {
        // Find code blocks that have language classes
        const codeBlockRegex = /<pre[^>]*><code[^>]*class="[^"]*language-([^"\s]+)[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/g;
        
        return html.replace(codeBlockRegex, (match, lang, code) => {
            // Decode HTML entities in the code using DOM parser for safety
            const parser = new DOMParser();
            const doc = parser.parseFromString(`<div>${code}</div>`, 'text/html');
            const decodedCode = doc.body.textContent || doc.body.innerText || '';
            
            if (lang && hljs.getLanguage(lang)) {
                try {
                    const highlighted = hljs.highlight(decodedCode, { language: lang }).value;
                    return `<pre class="hljs"><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                } catch (err) {
                    console.warn('Syntax highlighting failed:', err);
                }
            }
            
            return match; // Return original if highlighting fails
        });
    }

    /**
     * Post-process HTML to add custom classes and attributes
     * @param {string} html - The HTML to process
     * @returns {string} - The processed HTML
     */
    postProcessHtml(html) {
        // Add custom classes to elements.
        // Fenced code blocks must be classed before the inline-code pass: the
        // inline regex matches every bare <code> tag, so if it ran first it
        // would rewrite <pre><code> into <pre><code class="inline-code"> and
        // the block-level regexes below would no longer match, leaving block
        // code with the inline class and no hljs wrapper.
        html = html.replace(/<pre><code class="language-([^"]*)">/g, '<pre class="hljs"><code class="hljs language-$1">');
        html = html.replace(/<pre><code>/g, '<pre class="hljs"><code class="hljs">');
        html = html.replace(/<code>/g, '<code class="inline-code">');
        html = html.replace(/<table>/g, '<table class="table table-striped table-hover">');
        html = html.replace(/<blockquote>/g, '<blockquote class="blockquote border-start border-primary border-4 ps-3 ms-2">');
        
        // Add security attributes to links
        html = html.replace(/<a href="([^"]*)"([^>]*)>/g, '<a href="$1"$2 target="_blank" rel="noopener noreferrer">');
        
        return html;
    }

}

// Create a singleton instance
const markdownRenderer = new MarkdownRenderer();

export default markdownRenderer;
export { MarkdownRenderer };