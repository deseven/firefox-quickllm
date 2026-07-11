// Tests for escapeHtml in dom-utils.js — the single source of truth for HTML
// escaping.
import { describe, it, expect } from 'vitest';
import { escapeHtml } from './dom-utils.js';

// Build entity strings via char codes to avoid editor/tool entity decoding.
const AMP = String.fromCharCode(38) + 'amp;';
const LT = String.fromCharCode(38) + 'lt;';
const GT = String.fromCharCode(38) + 'gt;';
const QUOT = String.fromCharCode(38) + 'quot;';
const SQUOT = String.fromCharCode(38) + '#39;';

describe('escapeHtml', () => {
    it('escapes ampersands', () => {
        expect(escapeHtml('a & b')).toBe('a ' + AMP + ' b');
    });

    it('escapes less-than signs', () => {
        expect(escapeHtml('1 < 2')).toBe('1 ' + LT + ' 2');
    });

    it('escapes greater-than signs', () => {
        expect(escapeHtml('2 > 1')).toBe('2 ' + GT + ' 1');
    });

    it('escapes double quotes', () => {
        expect(escapeHtml('say "hi"')).toBe('say ' + QUOT + 'hi' + QUOT);
    });

    it('escapes single quotes', () => {
        expect(escapeHtml("it's")).toBe('it' + SQUOT + 's');
    });

    it('escapes all special characters in a single string', () => {
        const input = '<script>alert("x") & \'y\'</script>';
        const expected = LT + 'script' + GT + 'alert(' + QUOT + 'x' + QUOT + ') ' + AMP + ' ' + SQUOT + 'y' + SQUOT + LT + '/script' + GT;
        expect(escapeHtml(input)).toBe(expected);
    });

    it('returns the input unchanged when there are no special characters', () => {
        expect(escapeHtml('plain text 123')).toBe('plain text 123');
    });

    it('returns an empty string unchanged', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('coerces non-string input to a string', () => {
        expect(escapeHtml(42)).toBe('42');
    });

    it('escapes a string that already contains entities (raw ampersand is escaped)', () => {
        expect(escapeHtml(AMP)).toBe(AMP + 'amp;');
    });
});
