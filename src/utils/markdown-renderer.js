// Markdown renderer utility with GFM support and syntax highlighting
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';

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

// Register the languages with all common aliases
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('zsh', bash);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('go', go);
hljs.registerLanguage('golang', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c++', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xhtml', xml);
hljs.registerLanguage('svg', xml);

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
            let html = marked.parse(markdown);
            
            // Post-process the HTML to add our custom classes
            html = this.postProcessHtml(html);
            
            // Apply syntax highlighting to code blocks
            html = this.applySyntaxHighlighting(html);
            
            return html;
        } catch (error) {
            console.error('Markdown rendering failed:', error);
            // Fallback to escaped plain text
            return this.escapeHtml(markdown).replace(/\n/g, '<br>');
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
            // Decode HTML entities in the code using a comprehensive approach
            const textarea = document.createElement('textarea');
            textarea.innerHTML = code;
            const decodedCode = textarea.value;
            
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
        // Add custom classes to elements
        html = html.replace(/<code>/g, '<code class="inline-code">');
        html = html.replace(/<pre><code class="language-([^"]*)">/g, '<pre class="hljs"><code class="hljs language-$1">');
        html = html.replace(/<pre><code>/g, '<pre class="hljs"><code class="hljs">');
        html = html.replace(/<table>/g, '<table class="table table-striped table-hover">');
        html = html.replace(/<blockquote>/g, '<blockquote class="blockquote border-start border-primary border-4 ps-3 ms-2">');
        
        // Add security attributes to links
        html = html.replace(/<a href="([^"]*)"([^>]*)>/g, '<a href="$1"$2 target="_blank" rel="noopener noreferrer">');
        
        return html;
    }

    /**
     * Escape HTML characters for safety
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

}

// Create a singleton instance
const markdownRenderer = new MarkdownRenderer();

export default markdownRenderer;
export { MarkdownRenderer };