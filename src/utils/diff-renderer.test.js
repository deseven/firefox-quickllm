// Tests for DiffRenderer — the diff renderer that highlights changes between
// the original input text and the AI output text.
import { describe, it, expect, beforeEach } from 'vitest';
import { DiffRenderer } from './diff-renderer.js';

// Build entity strings via char codes to avoid editor/tool entity decoding.
const AMP = String.fromCharCode(38) + 'amp;';
const LT = String.fromCharCode(38) + 'lt;';
const GT = String.fromCharCode(38) + 'gt;';
const QUOT = String.fromCharCode(38) + 'quot;';
const SQUOT = String.fromCharCode(38) + '#39;';

describe('DiffRenderer.render', () => {
    let renderer;

    beforeEach(() => {
        renderer = new DiffRenderer();
    });

    it('returns escaped newText when originalText is empty', () => {
        const result = renderer.render('', 'hello <world>');
        expect(result).toBe('hello ' + LT + 'world' + GT);
    });

    it('returns escaped newText when originalText is null', () => {
        const result = renderer.render(null, 'hello');
        expect(result).toBe('hello');
    });

    it('returns escaped newText when originalText is undefined', () => {
        const result = renderer.render(undefined, 'hello');
        expect(result).toBe('hello');
    });

    it('returns escaped empty string when newText is empty and originalText is empty', () => {
        const result = renderer.render('', '');
        expect(result).toBe('');
    });

    it('returns escaped empty string when newText is null', () => {
        const result = renderer.render('original', null);
        expect(result).toBe('');
    });

    it('returns escaped empty string when newText is undefined', () => {
        const result = renderer.render('original', undefined);
        expect(result).toBe('');
    });

    it('wraps added text in <ins> tags', () => {
        const result = renderer.render('hello world', 'hello beautiful world');
        expect(result).toContain('<ins class="quickllm-diff-ins">');
        expect(result).toContain('</ins>');
        expect(result).toContain('beautiful');
    });

    it('wraps removed text in <del> tags', () => {
        const result = renderer.render('hello beautiful world', 'hello world');
        expect(result).toContain('<del class="quickllm-diff-del">');
        expect(result).toContain('</del>');
        expect(result).toContain('beautiful');
    });

    it('leaves unchanged text without tags', () => {
        const result = renderer.render('hello world', 'hello world');
        expect(result).toBe('hello world');
    });

    it('escapes HTML special characters in the output', () => {
        const result = renderer.render('text', 'text <script>alert("x")</script>');
        expect(result).toContain(LT + 'script' + GT);
        expect(result).not.toContain('<script>');
    });

    it('escapes HTML special characters in added parts', () => {
        const result = renderer.render('hello', 'hello <b>');
        expect(result).toContain(LT + 'b' + GT);
        expect(result).not.toContain('<b>');
    });

    it('escapes HTML special characters in removed parts', () => {
        const result = renderer.render('hello <b>', 'hello');
        expect(result).toContain(LT + 'b' + GT);
        expect(result).not.toContain('<b>');
    });

    it('handles identical strings with no changes', () => {
        const text = 'The quick brown fox';
        const result = renderer.render(text, text);
        expect(result).toBe(text);
    });

    it('handles completely different strings', () => {
        const result = renderer.render('aaa', 'bbb');
        expect(result).toContain('<del');
        expect(result).toContain('<ins');
        expect(result).toContain('aaa');
        expect(result).toContain('bbb');
    });

    it('handles partial word changes', () => {
        const result = renderer.render('running', 'walking');
        // Both words differ, so we expect del for removed and ins for added
        expect(result).toContain('<del');
        expect(result).toContain('<ins');
    });

    it('preserves the quickllm CSS classes on ins and del tags', () => {
        const result = renderer.render('a', 'b');
        expect(result).toContain('class="quickllm-diff-ins"');
        expect(result).toContain('class="quickllm-diff-del"');
    });
});
