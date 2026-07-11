/**
 * @vitest-environment jsdom
 */
// Tests for profile-selector.js — the keyboard navigation decision logic.
//
// resolveProfileSelectorAction is a pure function, so these tests cover
// every key path without needing a real DOM or modal.
import { describe, it, expect } from 'vitest';
import { resolveProfileSelectorAction } from './profile-selector.js';

function makeEvent(key, code, shiftKey = false) {
    return { key, code, shiftKey };
}

describe('resolveProfileSelectorAction', () => {
    const profileCount = 5;

    describe('number keys', () => {
        it('Digit1 selects index 0', () => {
            const result = resolveProfileSelectorAction(makeEvent('1', 'Digit1'), 2, profileCount);
            expect(result.action).toBe('select');
            expect(result.index).toBe(0);
            expect(result.shiftKey).toBe(false);
        });

        it('Digit9 selects index 8', () => {
            const result = resolveProfileSelectorAction(makeEvent('9', 'Digit9'), 0, 10);
            expect(result.action).toBe('select');
            expect(result.index).toBe(8);
        });

        it('Digit0 selects index 9', () => {
            const result = resolveProfileSelectorAction(makeEvent('0', 'Digit0'), 0, 10);
            expect(result.action).toBe('select');
            expect(result.index).toBe(9);
        });

        it('returns null action when number key exceeds profile count', () => {
            const result = resolveProfileSelectorAction(makeEvent('5', 'Digit5'), 0, 3);
            expect(result.action).toBeNull();
        });

        it('preserves shiftKey for number key selection', () => {
            const result = resolveProfileSelectorAction(makeEvent('1', 'Digit1', true), 0, profileCount);
            expect(result.shiftKey).toBe(true);
        });
    });

    describe('arrow keys', () => {
        it('ArrowUp moves selection up by one', () => {
            const result = resolveProfileSelectorAction(makeEvent('ArrowUp', 'ArrowUp'), 3, profileCount);
            expect(result.action).toBe('move');
            expect(result.index).toBe(2);
        });

        it('ArrowUp clamps at 0', () => {
            const result = resolveProfileSelectorAction(makeEvent('ArrowUp', 'ArrowUp'), 0, profileCount);
            expect(result.action).toBe('move');
            expect(result.index).toBe(0);
        });

        it('ArrowDown moves selection down by one', () => {
            const result = resolveProfileSelectorAction(makeEvent('ArrowDown', 'ArrowDown'), 2, profileCount);
            expect(result.action).toBe('move');
            expect(result.index).toBe(3);
        });

        it('ArrowDown clamps at profileCount - 1', () => {
            const result = resolveProfileSelectorAction(makeEvent('ArrowDown', 'ArrowDown'), 4, profileCount);
            expect(result.action).toBe('move');
            expect(result.index).toBe(4);
        });
    });

    describe('Enter and Escape', () => {
        it('Enter confirms the current selection', () => {
            const result = resolveProfileSelectorAction(makeEvent('Enter', 'Enter'), 2, profileCount);
            expect(result.action).toBe('confirm');
            expect(result.index).toBe(2);
        });

        it('Enter preserves shiftKey', () => {
            const result = resolveProfileSelectorAction(makeEvent('Enter', 'Enter', true), 0, profileCount);
            expect(result.shiftKey).toBe(true);
        });

        it('Escape cancels', () => {
            const result = resolveProfileSelectorAction(makeEvent('Escape', 'Escape'), 1, profileCount);
            expect(result.action).toBe('cancel');
        });
    });

    describe('unhandled keys', () => {
        it('returns null action for unrelated keys', () => {
            const result = resolveProfileSelectorAction(makeEvent('a', 'KeyA'), 0, profileCount);
            expect(result.action).toBeNull();
        });

        it('returns null action for Tab', () => {
            const result = resolveProfileSelectorAction(makeEvent('Tab', 'Tab'), 0, profileCount);
            expect(result.action).toBeNull();
        });
    });

    describe('edge cases', () => {
        it('handles a single profile list', () => {
            const result = resolveProfileSelectorAction(makeEvent('ArrowDown', 'ArrowDown'), 0, 1);
            expect(result.action).toBe('move');
            expect(result.index).toBe(0);
        });

        it('Digit1 works when there is exactly one profile', () => {
            const result = resolveProfileSelectorAction(makeEvent('1', 'Digit1'), 0, 1);
            expect(result.action).toBe('select');
            expect(result.index).toBe(0);
        });
    });
});
