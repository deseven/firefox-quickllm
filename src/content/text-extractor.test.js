/**
 * @vitest-environment jsdom
 */
// Tests for text-extractor.js — the pure extraction and cleanup logic.
//
// These tests cover the functions that don't require a full browser DOM:
// cleanMarkdown, removeUnwantedElements, findMainContentElement, and
// extractText (with mocked selection/document). The Turndown-dependent
// conversion is exercised end-to-end via getPageText with a minimal
// document stub.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    cleanMarkdown,
    removeUnwantedElements,
    findMainContentElement,
    getPageText,
    getSelectedText,
    extractText,
    _resetTurndownService
} from './text-extractor.js';

describe('cleanMarkdown', () => {
    it('collapses 4+ consecutive newlines down to 3', () => {
        expect(cleanMarkdown('a\n\n\n\n\nb')).toBe('a\n\n\nb');
    });

    it('leaves 3 or fewer newlines untouched', () => {
        expect(cleanMarkdown('a\n\n\nb')).toBe('a\n\n\nb');
        expect(cleanMarkdown('a\n\nb')).toBe('a\n\nb');
    });

    it('collapses runs of spaces and tabs into a single space', () => {
        expect(cleanMarkdown('a     b')).toBe('a b');
        expect(cleanMarkdown('a\t\tb')).toBe('a b');
        expect(cleanMarkdown('a \t b')).toBe('a b');
    });

    it('strips spaces and tabs surrounding newlines', () => {
        expect(cleanMarkdown('a   \n   b')).toBe('a\nb');
        expect(cleanMarkdown('a\t\n\tb')).toBe('a\nb');
    });

    it('trims leading and trailing whitespace', () => {
        expect(cleanMarkdown('   hello   ')).toBe('hello');
        expect(cleanMarkdown('\n\nhello\n\n')).toBe('hello');
    });

    it('returns empty string for empty input', () => {
        expect(cleanMarkdown('')).toBe('');
    });

    it('handles a complex mixed-whitespace string', () => {
        const input = '  # Title  \n\n\n\n\n  Some   text  \n  - item  ';
        const result = cleanMarkdown(input);
        expect(result).toBe('# Title\n\n\nSome text\n- item');
    });
});

describe('findMainContentElement', () => {
    function makeDoc(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc;
    }

    it('returns the <main> element when present', () => {
        const doc = makeDoc('<body><main><p>main</p></main><article><p>article</p></article></body>');
        const el = findMainContentElement(doc);
        expect(el).toBe(doc.querySelector('main'));
    });

    it('returns the <article> element when no <main> exists', () => {
        const doc = makeDoc('<body><article><p>article</p></article></body>');
        const el = findMainContentElement(doc);
        expect(el).toBe(doc.querySelector('article'));
    });

    it('returns [role="main"] element when no main/article exists', () => {
        const doc = makeDoc('<body><div role="main"><p>main role</p></div></body>');
        const el = findMainContentElement(doc);
        expect(el).toBe(doc.querySelector('[role="main"]'));
    });

    it('falls back to document.body when no content selectors match', () => {
        const doc = makeDoc('<body><div>just a div</div></body>');
        const el = findMainContentElement(doc);
        expect(el).toBe(doc.body);
    });

    it('returns null when document has no body', () => {
        const doc = /** @type {any} */ ({ querySelector: () => null, body: null });
        const el = findMainContentElement(doc);
        expect(el).toBeNull();
    });
});

describe('removeUnwantedElements', () => {
    function makeElement(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body;
    }

    it('removes script and style elements', () => {
        const el = makeElement('<script>alert(1)</script><style>.x{}</style><p>keep</p>');
        removeUnwantedElements(el);
        expect(el.querySelectorAll('script').length).toBe(0);
        expect(el.querySelectorAll('style').length).toBe(0);
        expect(el.querySelector('p')).not.toBeNull();
    });

    it('removes nav, header, footer, aside', () => {
        const el = makeElement('<nav>n</nav><header>h</header><footer>f</footer><aside>a</aside><p>keep</p>');
        removeUnwantedElements(el);
        expect(el.querySelectorAll('nav, header, footer, aside').length).toBe(0);
        expect(el.querySelector('p')).not.toBeNull();
    });

    it('removes elements by class selectors (ads, comments, etc.)', () => {
        const el = makeElement('<div class="ads">ad</div><div class="comments">c</div><div class="sidebar">s</div><p>keep</p>');
        removeUnwantedElements(el);
        expect(el.querySelectorAll('.ads, .comments, .sidebar').length).toBe(0);
        expect(el.querySelector('p')).not.toBeNull();
    });

    it('does not remove content elements', () => {
        const el = makeElement('<p>paragraph</p><h1>heading</h1><ul><li>item</li></ul>');
        removeUnwantedElements(el);
        expect(el.querySelectorAll('p, h1, ul, li').length).toBe(4);
    });
});

describe('getPageText', () => {
    beforeEach(() => {
        _resetTurndownService();
    });

    it('returns empty string when no main content element is found', () => {
        const doc = /** @type {any} */ ({ querySelector: () => null, body: null });
        expect(getPageText(doc)).toBe('');
    });

    it('converts HTML content to Markdown and cleans it', () => {
        const doc = new DOMParser().parseFromString(
            '<body><main><h1>Title</h1><p>Some paragraph.</p></main></body>',
            'text/html'
        );
        const result = getPageText(doc);
        expect(result).toContain('# Title');
        expect(result).toContain('Some paragraph.');
    });

    it('strips unwanted elements from the extracted content', () => {
        const doc = new DOMParser().parseFromString(
            '<body><main><p>keep this</p><script>alert(1)</script><nav>nav</nav></main></body>',
            'text/html'
        );
        const result = getPageText(doc);
        expect(result).toContain('keep this');
        expect(result).not.toContain('alert');
        expect(result).not.toContain('nav');
    });

    it('does not modify the original DOM', () => {
        const doc = new DOMParser().parseFromString(
            '<body><main><p>text</p><script>original</script></main></body>',
            'text/html'
        );
        getPageText(doc);
        // The original script element should still be present
        expect(doc.querySelector('script')).not.toBeNull();
        expect(doc.querySelector('script').textContent).toBe('original');
    });
});

describe('getSelectedText', () => {
    beforeEach(() => {
        _resetTurndownService();
    });

    it('returns the trimmed selection string', () => {
        const fakeSelection = { toString: () => '  hello world  ' };
        vi.stubGlobal('window', { getSelection: () => fakeSelection });
        expect(getSelectedText()).toBe('hello world');
        vi.unstubAllGlobals();
    });

    it('returns empty string when nothing is selected', () => {
        const fakeSelection = { toString: () => '' };
        vi.stubGlobal('window', { getSelection: () => fakeSelection });
        expect(getSelectedText()).toBe('');
        vi.unstubAllGlobals();
    });
});

describe('extractText', () => {
    beforeEach(() => {
        _resetTurndownService();
    });

    it('returns selected text when a selection exists', () => {
        const fakeSelection = { toString: () => 'selected snippet' };
        vi.stubGlobal('window', { getSelection: () => fakeSelection });
        const result = extractText();
        expect(result.text).toBe('selected snippet');
        expect(result.textType).toBe('selected text');
        vi.unstubAllGlobals();
    });

    it('falls back to page content when no selection exists', () => {
        const fakeSelection = { toString: () => '' };
        const doc = new DOMParser().parseFromString(
            '<body><main><p>page content here</p></main></body>',
            'text/html'
        );
        vi.stubGlobal('window', { getSelection: () => fakeSelection });
        const result = extractText(doc);
        expect(result.text).toContain('page content here');
        expect(result.textType).toBe('page content');
        vi.unstubAllGlobals();
    });
});
