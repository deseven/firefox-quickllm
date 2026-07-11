/**
 * @vitest-environment jsdom
 */
// Tests for MarkdownRenderer — converts markdown to HTML with GFM support,
// custom classes, and syntax highlighting. Covers the render() entry point,
// post-processing of the marked output, syntax highlighting for fenced code
// blocks, and the escaped-plaintext fallback when parsing fails.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MarkdownRenderer } from './markdown-renderer.js';
import { marked } from 'marked';
import { escapeHtml } from './dom-utils.js';

// Build entity strings via char codes to avoid editor/tool entity decoding.
const AMP = String.fromCharCode(38) + 'amp;';
const LT = String.fromCharCode(38) + 'lt;';
const GT = String.fromCharCode(38) + 'gt;';
const QUOT = String.fromCharCode(38) + 'quot;';

describe('MarkdownRenderer.render', () => {
    /** @type {any} */
    let renderer;

    beforeEach(() => {
        renderer = new MarkdownRenderer();
    });

    describe('input guards', () => {
        it('returns an empty string for null', () => {
            expect(renderer.render(null)).toBe('');
        });

        it('returns an empty string for undefined', () => {
            expect(renderer.render(undefined)).toBe('');
        });

        it('returns an empty string for an empty string', () => {
            expect(renderer.render('')).toBe('');
        });

        it('returns an empty string for a non-string value', () => {
            expect(renderer.render(123)).toBe('');
            expect(renderer.render({})).toBe('');
            expect(renderer.render([])).toBe('');
        });
    });

    describe('basic markdown', () => {
        it('renders a level-1 heading', () => {
            const html = renderer.render('# Title');
            expect(html).toContain('<h1>');
            expect(html).toContain('Title');
            expect(html).toContain('</h1>');
        });

        it('renders bold text', () => {
            const html = renderer.render('**bold**');
            expect(html).toContain('<strong>bold</strong>');
        });

        it('renders italic text', () => {
            const html = renderer.render('*italic*');
            expect(html).toContain('<em>italic</em>');
        });

        it('renders a paragraph of plain text', () => {
            const html = renderer.render('Just a paragraph.');
            expect(html).toContain('Just a paragraph.');
        });

        it('renders an unordered list', () => {
            const html = renderer.render('- one\n- two\n- three');
            expect(html).toContain('<ul>');
            expect(html).toContain('<li>one</li>');
            expect(html).toContain('<li>two</li>');
            expect(html).toContain('<li>three</li>');
            expect(html).toContain('</ul>');
        });

        it('converts single newlines to <br> (breaks: true)', () => {
            const html = renderer.render('line one\nline two');
            expect(html).toContain('<br>');
            expect(html).toContain('line one');
            expect(html).toContain('line two');
        });
    });

    describe('inline code', () => {
        it('adds the inline-code class to inline code spans', () => {
            const html = renderer.render('Use `console.log` to print.');
            expect(html).toContain('<code class="inline-code">console.log</code>');
        });
    });

    describe('fenced code blocks', () => {
        it('adds hljs classes to a fenced code block with a language', () => {
            const html = renderer.render('```js\nconst x = 1;\n```');
            expect(html).toContain('<pre class="hljs">');
            expect(html).toContain('class="hljs language-js"');
            // The code content survives (highlighted tokens still contain the
            // source text as substrings).
            expect(html).toContain('const');
            expect(html).toContain('x =');
            expect(html).toContain('1');
        });

        it('adds hljs classes to a fenced code block without a language', () => {
            const html = renderer.render('```\nplain code\n```');
            expect(html).toContain('<pre class="hljs">');
            expect(html).toContain('<code class="hljs">');
            expect(html).toContain('plain code');
            // A block-level <code> must not receive the inline-code class.
            expect(html).not.toContain('inline-code');
        });

        it('applies syntax highlighting for a registered language', () => {
            const html = renderer.render('```javascript\nconst x = 1;\n```');
            // highlight.js wraps tokens in spans; the highlighted output should
            // contain at least one span for the keyword/declaration.
            expect(html).toContain('<pre class="hljs">');
            expect(html).toContain('class="hljs language-javascript"');
            expect(html).toContain('const');
        });

        it('leaves the block unchanged for an unregistered language', () => {
            const html = renderer.render('```cobol\nMOVE 1 TO X\n```');
            // No highlighting is applied, but the hljs wrapper classes are still
            // added by postProcessHtml.
            expect(html).toContain('<pre class="hljs">');
            expect(html).toContain('MOVE 1 TO X');
        });
    });

    describe('links', () => {
        it('adds target="_blank" and rel="noopener noreferrer" to links', () => {
            const html = renderer.render('[Click](https://example.com)');
            expect(html).toContain('href="https://example.com"');
            expect(html).toContain('target="_blank"');
            expect(html).toContain('rel="noopener noreferrer"');
            expect(html).toContain('>Click</a>');
        });
    });

    describe('tables', () => {
        it('adds table classes to GFM tables', () => {
            const html = renderer.render('| a | b |\n|---|---|\n| 1 | 2 |');
            expect(html).toContain('<table class="table table-striped table-hover">');
            expect(html).toContain('<th>a</th>');
            expect(html).toContain('<td>1</td>');
        });
    });

    describe('blockquotes', () => {
        it('adds blockquote classes to blockquotes', () => {
            const html = renderer.render('> A notable quote.');
            expect(html).toContain('<blockquote class="blockquote');
            expect(html).toContain('A notable quote.');
        });
    });

    describe('error fallback', () => {
        /** @type {any} */
        let parseSpy;
        /** @type {any} */
        let errorSpy;

        beforeEach(() => {
            parseSpy = vi.spyOn(marked, 'parse');
            errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            parseSpy.mockRestore();
            errorSpy.mockRestore();
        });

        it('falls back to escaped plain text with <br> when parsing throws', () => {
            const markdown = 'line1\nline2 <script>';
            parseSpy.mockImplementationOnce(() => {
                throw new Error('parse failed');
            });

            const html = renderer.render(markdown);

            expect(errorSpy).toHaveBeenCalledWith(
                'Markdown rendering failed:',
                expect.any(Error)
            );
            // escapeHtml escapes < and >, then newlines become <br>.
            const expected = escapeHtml(markdown).replace(/\n/g, '<br>');
            expect(html).toBe(expected);
            expect(html).toContain(LT + 'script' + GT);
            expect(html).toContain('<br>');
        });

        it('escapes special characters in the fallback output', () => {
            const markdown = 'a & b < c > d "e"';
            parseSpy.mockImplementationOnce(() => {
                throw new Error('parse failed');
            });

            const html = renderer.render(markdown);

            expect(html).toContain(AMP);
            expect(html).toContain(LT);
            expect(html).toContain(GT);
            expect(html).toContain(QUOT);
        });
    });
});
