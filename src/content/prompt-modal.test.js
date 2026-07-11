/**
 * @vitest-environment jsdom
 */
// Tests for prompt-modal.js — the Enter-key decision logic.
//
// resolveEnterAction is a pure function that decides whether Enter should
// copy the response (and close) or trigger a new process. These tests
// cover every branch of that decision.
import { describe, it, expect } from 'vitest';
import { resolveEnterAction } from './prompt-modal.js';

describe('resolveEnterAction', () => {
    it('returns "copy" when response is available and prompt is unchanged', () => {
        expect(resolveEnterAction(true, true, 'same prompt', 'same prompt', true)).toBe('copy');
    });

    it('returns "process" when no response is available', () => {
        expect(resolveEnterAction(false, true, 'prompt', 'prompt', true)).toBe('process');
    });

    it('returns "process" when nothing has been processed yet', () => {
        expect(resolveEnterAction(true, false, 'prompt', 'prompt', true)).toBe('process');
    });

    it('returns "process" when the prompt has changed since last process', () => {
        expect(resolveEnterAction(true, true, 'new prompt', 'old prompt', true)).toBe('process');
    });

    it('returns "process" when the copy button is not visible', () => {
        expect(resolveEnterAction(true, true, 'prompt', 'prompt', false)).toBe('process');
    });

    it('returns "process" when all conditions are false', () => {
        expect(resolveEnterAction(false, false, 'a', 'b', false)).toBe('process');
    });

    it('treats empty prompt matching empty original as "copy" when other conditions hold', () => {
        expect(resolveEnterAction(true, true, '', '', true)).toBe('copy');
    });

    it('is case-sensitive when comparing prompts', () => {
        expect(resolveEnterAction(true, true, 'Prompt', 'prompt', true)).toBe('process');
    });

    it('returns "process" when only hasResponse is true but hasProcessedOnce is false', () => {
        // Defensive: hasResponse true but never processed — shouldn't happen,
        // but the function should still default to process.
        expect(resolveEnterAction(true, false, 'p', 'p', true)).toBe('process');
    });
});
