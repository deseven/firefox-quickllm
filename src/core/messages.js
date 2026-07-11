// Centralized message passing contract for the extension.
//
// All runtime/tab messages flow through a single set of type constants,
// factory functions, and lightweight validators. This replaces the
// scattered string literals that were duplicated across background.js,
// injector.js, base-provider.js, storage-utils.js, and extension.js.
//
// Every message has:
//   - a `type` constant exported from MESSAGE_TYPES
//   - a factory function that builds the message payload
//   - a validator (assert) that throws on malformed payloads
//
// Senders should use the factory functions; receivers should use
// `assertMessage` (or the per-type asserts) to validate before handling.

/**
 * Message type constants — the single source of truth for message names.
 * Use these instead of raw strings when building or matching messages.
 */

/**
 * A configured LLM profile. Re-exported here so modules that only deal with
 * message passing can reference the profile shape without importing from the
 * content layer.
 * @typedef {import('../content/types.js').Profile} Profile
 */

/**
 * Payload for a processWithLLM message.
 * @typedef {Object} ProcessWithLLMMessage
 * @property {typeof MESSAGE_TYPES.PROCESS_WITH_LLM} type
 * @property {Profile} profile - Full profile object (includes apiKey)
 * @property {string} userPrompt - The user's prompt
 * @property {string} text - The text to process
 * @property {boolean} isStreaming - Whether to stream the response
 * @property {string} streamId - Unique stream identifier
 */

/**
 * Payload for a streamUpdate message sent to a content script.
 * @typedef {Object} StreamUpdateMessage
 * @property {typeof MESSAGE_TYPES.STREAM_UPDATE} type
 * @property {string} content - The accumulated response content so far
 * @property {string} streamId - The stream this update belongs to
 */

/**
 * Success response for a processWithLLM request.
 * @typedef {Object} LLMSuccessResponse
 * @property {true} success
 * @property {string} response - The full response text
 * @property {string} streamId - The stream ID that was used
 */

/**
 * Error response for a processWithLLM request.
 * @typedef {Object} LLMErrorResponse
 * @property {false} success
 * @property {string} error - The error message
 */
export const MESSAGE_TYPES = Object.freeze({
    // runtime messages (popup/content -> background)
    GET_PROFILES: 'getProfiles',
    PROCESS_WITH_LLM: 'processWithLLM',
    CANCEL_STREAM: 'cancelStream',
    OPEN_POPUP: 'openPopup',
    PROFILES_UPDATED: 'profilesUpdated',

    // tab messages (background -> content script)
    PROCESS_CONTENT: 'processContent',
    STREAM_UPDATE: 'streamUpdate'
});

/**
 * Fields that must never be overwritten when merging user-supplied
 * extra options into a provider request. Kept here so the contract
 * is documented in one place alongside the message definitions.
 */
export const PROTECTED_REQUEST_FIELDS = Object.freeze([
    'model',
    'messages',
    'stream'
]);

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

/**
 * Build a getProfiles message.
 * @returns {{ type: string }}
 */
export function createGetProfilesMessage() {
    return { type: MESSAGE_TYPES.GET_PROFILES };
}

/**
 * Build a processWithLLM message.
 * @param {Profile} profile - Full profile object (includes apiKey)
 * @param {string} userPrompt - The user's prompt
 * @param {string} text - The text to process
 * @param {boolean} isStreaming - Whether to stream the response
 * @param {string} streamId - Unique stream identifier
 * @returns {ProcessWithLLMMessage}
 */
export function createProcessWithLLMMessage(profile, userPrompt, text, isStreaming, streamId) {
    return {
        type: MESSAGE_TYPES.PROCESS_WITH_LLM,
        profile,
        userPrompt,
        text,
        isStreaming,
        streamId
    };
}

/**
 * Build a cancelStream message.
 * @param {string} streamId - The stream ID to cancel
 * @returns {{ type: string, streamId: string }}
 */
export function createCancelStreamMessage(streamId) {
    return {
        type: MESSAGE_TYPES.CANCEL_STREAM,
        streamId
    };
}

/**
 * Build an openPopup message.
 * @returns {{ type: string }}
 */
export function createOpenPopupMessage() {
    return { type: MESSAGE_TYPES.OPEN_POPUP };
}

/**
 * Build a profilesUpdated notification (fire-and-forget).
 * @returns {{ type: string }}
 */
export function createProfilesUpdatedMessage() {
    return { type: MESSAGE_TYPES.PROFILES_UPDATED };
}

/**
 * Build a processContent message sent to a content script.
 * @param {string|null} [profileId] - Optional profile ID to process with
 * @returns {{ type: string, profileId?: string }}
 */
export function createProcessContentMessage(profileId = null) {
    /** @type {{ type: string, profileId?: string }} */
    const message = { type: MESSAGE_TYPES.PROCESS_CONTENT };
    if (profileId !== null && profileId !== undefined) {
        message.profileId = profileId;
    }
    return message;
}

/**
 * Build a streamUpdate message sent to a content script.
 * @param {string} content - The accumulated response content so far
 * @param {string} streamId - The stream this update belongs to
 * @returns {StreamUpdateMessage}
 */
export function createStreamUpdateMessage(content, streamId) {
    return {
        type: MESSAGE_TYPES.STREAM_UPDATE,
        content,
        streamId
    };
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

/**
 * Build a success response for a processWithLLM request.
 * @param {string} response - The full response text
 * @param {string} streamId - The stream ID that was used
 * @returns {LLMSuccessResponse}
 */
export function createLLMSuccessResponse(response, streamId) {
    return { success: true, response, streamId };
}

/**
 * Build an error response for a processWithLLM request.
 * @param {string} error - The error message
 * @returns {LLMErrorResponse}
 */
export function createLLMErrorResponse(error) {
    return { success: false, error };
}

/**
 * Build a getProfiles response.
 * @param {Profile[]} profiles - Array of profile objects
 * @param {string|null} [error] - Optional error message
 * @returns {{ profiles: Profile[], error: string|null }}
 */
export function createGetProfilesResponse(profiles, error = null) {
    return { profiles, error };
}

/**
 * Build a success response for a cancelStream request.
 * @returns {{ success: true }}
 */
export function createCancelStreamSuccessResponse() {
    return { success: true };
}

/**
 * Build an error response for a cancelStream request.
 * @param {string} error - The error message
 * @returns {{ success: false, error: string }}
 */
export function createCancelStreamErrorResponse(error) {
    return { success: false, error };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Assert that a value is a string (empty strings are allowed).
 * @param {*} value
 * @param {string} field - Field name for the error message
 * @throws {Error} if the value is not a string
 */
function assertString(value, field) {
    if (typeof value !== 'string') {
        throw new Error(`Invalid message: "${field}" must be a string`);
    }
}

/**
 * Assert that a value is a non-empty string.
 * Used for identifiers (streamId, profileId) that must have a value.
 * @param {*} value
 * @param {string} field - Field name for the error message
 * @throws {Error} if the value is not a non-empty string
 */
function assertNonEmptyString(value, field) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Invalid message: "${field}" must be a non-empty string`);
    }
}

/**
 * Assert that a value is a boolean.
 * @param {*} value
 * @param {string} field
 * @throws {Error} if the value is not a boolean
 */
function assertBoolean(value, field) {
    if (typeof value !== 'boolean') {
        throw new Error(`Invalid message: "${field}" must be a boolean`);
    }
}

/**
 * Assert that a value is a non-null object.
 * @param {*} value
 * @param {string} field
 * @throws {Error} if the value is not an object
 */
function assertObject(value, field) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`Invalid message: "${field}" must be an object`);
    }
}

/**
 * Validators for each message type.
 * Each throws an Error if the payload is malformed.
 * @type {Record<string, (message: any) => void>}
 */
export const MESSAGE_VALIDATORS = Object.freeze({
    [MESSAGE_TYPES.GET_PROFILES](message) {
        // No payload fields beyond type
    },

    [MESSAGE_TYPES.PROCESS_WITH_LLM](message) {
        assertObject(message.profile, 'profile');
        assertString(message.userPrompt, 'userPrompt');
        assertString(message.text, 'text');
        assertBoolean(message.isStreaming, 'isStreaming');
        assertNonEmptyString(message.streamId, 'streamId');
    },

    [MESSAGE_TYPES.CANCEL_STREAM](message) {
        assertNonEmptyString(message.streamId, 'streamId');
    },

    [MESSAGE_TYPES.OPEN_POPUP](message) {
        // No payload fields beyond type
    },

    [MESSAGE_TYPES.PROFILES_UPDATED](message) {
        // No payload fields beyond type
    },

    [MESSAGE_TYPES.PROCESS_CONTENT](message) {
        if (message.profileId !== undefined && message.profileId !== null) {
            assertNonEmptyString(message.profileId, 'profileId');
        }
    },

    [MESSAGE_TYPES.STREAM_UPDATE](message) {
        assertNonEmptyString(message.content, 'content');
        assertNonEmptyString(message.streamId, 'streamId');
    }
});

/**
 * Validate a message against its type's schema.
 * Throws an Error if the message is missing a type, has an unknown type,
 * or fails the type-specific validation.
 * @param {*} message - The message to validate
 * @returns {string} The validated message type
 * @throws {Error} if the message is invalid
 */
export function assertMessage(message) {
    if (!message || typeof message !== 'object') {
        throw new Error('Invalid message: expected an object');
    }
    const type = /** @type {any} */ (message).type;
    if (typeof type !== 'string' || type.length === 0) {
        throw new Error('Invalid message: missing or empty "type"');
    }
    const validator = MESSAGE_VALIDATORS[type];
    if (!validator) {
        throw new Error(`Invalid message: unknown type "${type}"`);
    }
    validator(message);
    return type;
}

/**
 * Safely validate a message without throwing.
 * @param {*} message - The message to validate
 * @returns {{ valid: boolean, error: string|null, type: string|null }}
 */
export function validateMessage(message) {
    try {
        const type = assertMessage(message);
        return { valid: true, error: null, type };
    } catch (error) {
        return { valid: false, error: /** @type {Error} */ (error).message, type: /** @type {any} */ (message)?.type ?? null };
    }
}
