// Tests for the centralized message passing contract in messages.js.
// Covers type constants, factory functions, response helpers, and validators.
import { describe, it, expect } from 'vitest';
import {
    MESSAGE_TYPES,
    PROTECTED_REQUEST_FIELDS,
    createGetProfilesMessage,
    createProcessWithLLMMessage,
    createCancelStreamMessage,
    createOpenPopupMessage,
    createProfilesUpdatedMessage,
    createProcessContentMessage,
    createStreamUpdateMessage,
    createLLMSuccessResponse,
    createLLMErrorResponse,
    createGetProfilesResponse,
    createCancelStreamSuccessResponse,
    createCancelStreamErrorResponse,
    assertMessage,
    validateMessage,
    MESSAGE_VALIDATORS
} from './messages.js';

describe('MESSAGE_TYPES', () => {
    it('is frozen', () => {
        expect(Object.isFrozen(MESSAGE_TYPES)).toBe(true);
    });

    it('contains all expected message types', () => {
        expect(MESSAGE_TYPES.GET_PROFILES).toBe('getProfiles');
        expect(MESSAGE_TYPES.PROCESS_WITH_LLM).toBe('processWithLLM');
        expect(MESSAGE_TYPES.CANCEL_STREAM).toBe('cancelStream');
        expect(MESSAGE_TYPES.OPEN_POPUP).toBe('openPopup');
        expect(MESSAGE_TYPES.PROFILES_UPDATED).toBe('profilesUpdated');
        expect(MESSAGE_TYPES.PROCESS_CONTENT).toBe('processContent');
        expect(MESSAGE_TYPES.STREAM_UPDATE).toBe('streamUpdate');
    });
});

describe('PROTECTED_REQUEST_FIELDS', () => {
    it('is frozen', () => {
        expect(Object.isFrozen(PROTECTED_REQUEST_FIELDS)).toBe(true);
    });

    it('protects model, messages, and stream', () => {
        expect(PROTECTED_REQUEST_FIELDS).toContain('model');
        expect(PROTECTED_REQUEST_FIELDS).toContain('messages');
        expect(PROTECTED_REQUEST_FIELDS).toContain('stream');
    });
});

describe('factory functions', () => {
    it('createGetProfilesMessage sets the type', () => {
        expect(createGetProfilesMessage()).toEqual({ type: 'getProfiles' });
    });

    it('createProcessWithLLMMessage builds the full payload', () => {
        const profile = { id: '1', type: 'openai' };
        const message = createProcessWithLLMMessage(profile, 'prompt', 'text', true, 's1');
        expect(message).toEqual({
            type: 'processWithLLM',
            profile,
            userPrompt: 'prompt',
            text: 'text',
            isStreaming: true,
            streamId: 's1'
        });
    });

    it('createCancelStreamMessage sets type and streamId', () => {
        expect(createCancelStreamMessage('s1')).toEqual({ type: 'cancelStream', streamId: 's1' });
    });

    it('createOpenPopupMessage sets the type', () => {
        expect(createOpenPopupMessage()).toEqual({ type: 'openPopup' });
    });

    it('createProfilesUpdatedMessage sets the type', () => {
        expect(createProfilesUpdatedMessage()).toEqual({ type: 'profilesUpdated' });
    });

    it('createProcessContentMessage omits profileId when null', () => {
        expect(createProcessContentMessage()).toEqual({ type: 'processContent' });
        expect(createProcessContentMessage(null)).toEqual({ type: 'processContent' });
    });

    it('createProcessContentMessage includes profileId when provided', () => {
        expect(createProcessContentMessage('p1')).toEqual({
            type: 'processContent',
            profileId: 'p1'
        });
    });

    it('createStreamUpdateMessage sets type, content, and streamId', () => {
        expect(createStreamUpdateMessage('hello', 's1')).toEqual({
            type: 'streamUpdate',
            content: 'hello',
            streamId: 's1'
        });
    });
});

describe('response helpers', () => {
    it('createLLMSuccessResponse includes response and streamId', () => {
        expect(createLLMSuccessResponse('text', 's1')).toEqual({
            success: true,
            response: 'text',
            streamId: 's1'
        });
    });

    it('createLLMErrorResponse includes the error message', () => {
        expect(createLLMErrorResponse('boom')).toEqual({ success: false, error: 'boom' });
    });

    it('createGetProfilesResponse defaults error to null', () => {
        expect(createGetProfilesResponse([])).toEqual({ profiles: [], error: null });
    });

    it('createGetProfilesResponse accepts an error', () => {
        expect(createGetProfilesResponse([], 'oops')).toEqual({ profiles: [], error: 'oops' });
    });

    it('createCancelStreamSuccessResponse', () => {
        expect(createCancelStreamSuccessResponse()).toEqual({ success: true });
    });

    it('createCancelStreamErrorResponse', () => {
        expect(createCancelStreamErrorResponse('not found')).toEqual({ success: false, error: 'not found' });
    });
});

describe('assertMessage', () => {
    it('returns the type for a valid getProfiles message', () => {
        expect(assertMessage(createGetProfilesMessage())).toBe('getProfiles');
    });

    it('returns the type for a valid processWithLLM message', () => {
        const message = createProcessWithLLMMessage(
            { id: '1' }, 'prompt', 'text', false, 's1'
        );
        expect(assertMessage(message)).toBe('processWithLLM');
    });

    it('returns the type for a valid cancelStream message', () => {
        expect(assertMessage(createCancelStreamMessage('s1'))).toBe('cancelStream');
    });

    it('returns the type for a valid openPopup message', () => {
        expect(assertMessage(createOpenPopupMessage())).toBe('openPopup');
    });

    it('returns the type for a valid profilesUpdated message', () => {
        expect(assertMessage(createProfilesUpdatedMessage())).toBe('profilesUpdated');
    });

    it('returns the type for a valid processContent message without profileId', () => {
        expect(assertMessage(createProcessContentMessage())).toBe('processContent');
    });

    it('returns the type for a valid processContent message with profileId', () => {
        expect(assertMessage(createProcessContentMessage('p1'))).toBe('processContent');
    });

    it('returns the type for a valid streamUpdate message', () => {
        expect(assertMessage(createStreamUpdateMessage('content', 's1'))).toBe('streamUpdate');
    });

    it('throws when message is not an object', () => {
        expect(() => assertMessage(null)).toThrow('expected an object');
        expect(() => assertMessage('string')).toThrow('expected an object');
        expect(() => assertMessage(undefined)).toThrow('expected an object');
    });

    it('throws when type is missing', () => {
        expect(() => assertMessage({})).toThrow('missing or empty "type"');
    });

    it('throws when type is an empty string', () => {
        expect(() => assertMessage({ type: '' })).toThrow('missing or empty "type"');
    });

    it('throws when type is not a string', () => {
        expect(() => assertMessage({ type: 42 })).toThrow('missing or empty "type"');
    });

    it('throws for an unknown type', () => {
        expect(() => assertMessage({ type: 'unknownType' })).toThrow('unknown type "unknownType"');
    });
});

describe('assertMessage — processWithLLM validation', () => {
    const validProfile = { id: '1', type: 'openai' };

    it('throws when profile is missing', () => {
        const message = { type: 'processWithLLM', userPrompt: 'p', text: 't', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"profile" must be an object');
    });

    it('throws when profile is null', () => {
        const message = { type: 'processWithLLM', profile: null, userPrompt: 'p', text: 't', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"profile" must be an object');
    });

    it('throws when profile is an array', () => {
        const message = { type: 'processWithLLM', profile: [], userPrompt: 'p', text: 't', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"profile" must be an object');
    });

    it('throws when userPrompt is missing', () => {
        const message = { type: 'processWithLLM', profile: validProfile, text: 't', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"userPrompt" must be a string');
    });

    it('throws when userPrompt is not a string', () => {
        const message = { type: 'processWithLLM', profile: validProfile, userPrompt: 42, text: 't', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"userPrompt" must be a string');
    });

    it('accepts an empty string for userPrompt', () => {
        const message = { type: 'processWithLLM', profile: validProfile, userPrompt: '', text: 't', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).not.toThrow();
    });

    it('throws when text is missing', () => {
        const message = { type: 'processWithLLM', profile: validProfile, userPrompt: 'p', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"text" must be a string');
    });

    it('throws when text is not a string', () => {
        const message = { type: 'processWithLLM', profile: validProfile, userPrompt: 'p', text: 42, isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"text" must be a string');
    });

    it('accepts an empty string for text', () => {
        const message = { type: 'processWithLLM', profile: validProfile, userPrompt: 'p', text: '', isStreaming: true, streamId: 's1' };
        expect(() => assertMessage(message)).not.toThrow();
    });

    it('throws when isStreaming is not a boolean', () => {
        const message = { type: 'processWithLLM', profile: validProfile, userPrompt: 'p', text: 't', isStreaming: 'yes', streamId: 's1' };
        expect(() => assertMessage(message)).toThrow('"isStreaming" must be a boolean');
    });

    it('throws when streamId is missing', () => {
        const message = { type: 'processWithLLM', profile: validProfile, userPrompt: 'p', text: 't', isStreaming: true };
        expect(() => assertMessage(message)).toThrow('"streamId" must be a non-empty string');
    });
});

describe('assertMessage — cancelStream validation', () => {
    it('throws when streamId is missing', () => {
        expect(() => assertMessage({ type: 'cancelStream' })).toThrow('"streamId" must be a non-empty string');
    });

    it('throws when streamId is an empty string', () => {
        expect(() => assertMessage({ type: 'cancelStream', streamId: '' })).toThrow('"streamId" must be a non-empty string');
    });
});

describe('assertMessage — processContent validation', () => {
    it('passes when profileId is undefined', () => {
        expect(() => assertMessage({ type: 'processContent' })).not.toThrow();
    });

    it('passes when profileId is null', () => {
        expect(() => assertMessage({ type: 'processContent', profileId: null })).not.toThrow();
    });

    it('passes when profileId is a non-empty string', () => {
        expect(() => assertMessage({ type: 'processContent', profileId: 'p1' })).not.toThrow();
    });

    it('throws when profileId is an empty string', () => {
        expect(() => assertMessage({ type: 'processContent', profileId: '' })).toThrow('"profileId" must be a non-empty string');
    });

    it('throws when profileId is a number', () => {
        expect(() => assertMessage({ type: 'processContent', profileId: 5 })).toThrow('"profileId" must be a non-empty string');
    });
});

describe('assertMessage — streamUpdate validation', () => {
    it('throws when content is missing', () => {
        expect(() => assertMessage({ type: 'streamUpdate', streamId: 's1' })).toThrow('"content" must be a non-empty string');
    });

    it('throws when streamId is missing', () => {
        expect(() => assertMessage({ type: 'streamUpdate', content: 'c' })).toThrow('"streamId" must be a non-empty string');
    });
});

describe('validateMessage', () => {
    it('returns valid:true for a well-formed message', () => {
        const result = validateMessage(createGetProfilesMessage());
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
        expect(result.type).toBe('getProfiles');
    });

    it('returns valid:false with an error message for a malformed message', () => {
        const result = validateMessage({ type: 'cancelStream' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('"streamId"');
        expect(result.type).toBe('cancelStream');
    });

    it('returns valid:false for a non-object', () => {
        const result = validateMessage(null);
        expect(result.valid).toBe(false);
        expect(result.type).toBeNull();
    });

    it('returns valid:false for an unknown type', () => {
        const result = validateMessage({ type: 'bogus' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('unknown type');
        expect(result.type).toBe('bogus');
    });

    it('returns valid:false when type is missing', () => {
        const result = validateMessage({});
        expect(result.valid).toBe(false);
        expect(result.type).toBeNull();
    });
});

describe('MESSAGE_VALIDATORS', () => {
    it('is frozen', () => {
        expect(Object.isFrozen(MESSAGE_VALIDATORS)).toBe(true);
    });

    it('has a validator for every message type', () => {
        for (const type of Object.values(MESSAGE_TYPES)) {
            expect(typeof MESSAGE_VALIDATORS[type]).toBe('function');
        }
    });
});
